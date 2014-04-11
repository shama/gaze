/*
Copyright (c) 2013 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
#include <algorithm>
#include <map>
#include <memory>

#include "common.h"

// Size of the buffer to store result of ReadDirectoryChangesW.
static const unsigned int kDirectoryWatcherBufferSize = 4096;

// Object template to create representation of WatcherHandle.
static Persistent<ObjectTemplate> g_object_template;

// Mutex for the HandleWrapper map.
static uv_mutex_t g_handle_wrap_map_mutex;

// The events to be waited on.
static std::vector<HANDLE> g_events;

// The dummy event to wakeup the thread.
static HANDLE g_wake_up_event;

struct ScopedLocker {
  explicit ScopedLocker(uv_mutex_t& mutex) : mutex_(&mutex) { uv_mutex_lock(mutex_); }
  ~ScopedLocker() { Unlock(); }

  void Unlock() { uv_mutex_unlock(mutex_); }

  uv_mutex_t* mutex_;
};

struct HandleWrapper {
  HandleWrapper(WatcherHandle handle, const char* path_str)
      : dir_handle(handle),
        path(strlen(path_str)),
        canceled(false) {
    memset(&overlapped, 0, sizeof(overlapped));
    overlapped.hEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
    g_events.push_back(overlapped.hEvent);

    std::copy(path_str, path_str + path.size(), path.data());
    map_[overlapped.hEvent] = this;
  }

  ~HandleWrapper() {
    CloseFile();

    map_.erase(overlapped.hEvent);
    CloseHandle(overlapped.hEvent);
    g_events.erase(
        std::remove(g_events.begin(), g_events.end(), overlapped.hEvent),
        g_events.end());
  }

  void CloseFile() {
    if (dir_handle != INVALID_HANDLE_VALUE) {
      CloseHandle(dir_handle);
      dir_handle = INVALID_HANDLE_VALUE;
    }
  }

  WatcherHandle dir_handle;
  std::vector<char> path;
  bool canceled;
  OVERLAPPED overlapped;
  char buffer[kDirectoryWatcherBufferSize];

  static HandleWrapper* Get(HANDLE key) { return map_[key]; }

  static std::map<WatcherHandle, HandleWrapper*> map_;
};

std::map<WatcherHandle, HandleWrapper*> HandleWrapper::map_;

struct WatcherEvent {
  EVENT_TYPE type;
  WatcherHandle handle;
  std::vector<char> new_path;
  std::vector<char> old_path;
};

static bool QueueReaddirchanges(HandleWrapper* handle) {
  return ReadDirectoryChangesW(handle->dir_handle,
                               handle->buffer,
                               kDirectoryWatcherBufferSize,
                               FALSE,
                               FILE_NOTIFY_CHANGE_FILE_NAME      |
                                 FILE_NOTIFY_CHANGE_DIR_NAME     |
                                 FILE_NOTIFY_CHANGE_ATTRIBUTES   |
                                 FILE_NOTIFY_CHANGE_SIZE         |
                                 FILE_NOTIFY_CHANGE_LAST_WRITE   |
                                 FILE_NOTIFY_CHANGE_LAST_ACCESS  |
                                 FILE_NOTIFY_CHANGE_CREATION     |
                                 FILE_NOTIFY_CHANGE_SECURITY,
                               NULL,
                               &handle->overlapped,
                               NULL) == TRUE;
}

Handle<Value> WatcherHandleToV8Value(WatcherHandle handle) {
  Handle<Value> value = NanPersistentToLocal(g_object_template)->NewInstance();
  NanSetInternalFieldPointer(value->ToObject(), 0, handle);
  return value;
}

WatcherHandle V8ValueToWatcherHandle(Handle<Value> value) {
  return reinterpret_cast<WatcherHandle>(NanGetInternalFieldPointer(
      value->ToObject(), 0));
}

bool IsV8ValueWatcherHandle(Handle<Value> value) {
  return value->IsObject() && value->ToObject()->InternalFieldCount() == 1;
}

void PlatformInit() {
  uv_mutex_init(&g_handle_wrap_map_mutex);

  g_wake_up_event = CreateEvent(NULL, FALSE, FALSE, NULL);
  g_events.push_back(g_wake_up_event);

  NanAssignPersistent(ObjectTemplate, g_object_template, ObjectTemplate::New());
  NanPersistentToLocal(g_object_template)->SetInternalFieldCount(1);

  WakeupNewThread();
}

void PlatformThread() {
  while (true) {
    // Do not use g_events directly, since reallocation could happen when there
    // are new watchers adding to g_events when WaitForMultipleObjects is still
    // polling.
    ScopedLocker locker(g_handle_wrap_map_mutex);
    std::vector<HANDLE> copied_events(g_events);
    locker.Unlock();

    DWORD r = WaitForMultipleObjects(copied_events.size(),
                                     copied_events.data(),
                                     FALSE,
                                     INFINITE);
    int i = r - WAIT_OBJECT_0;
    if (i >= 0 && i < copied_events.size()) {
      // It's a wake up event, there is no fs events.
      if (copied_events[i] == g_wake_up_event)
        continue;

      ScopedLocker locker(g_handle_wrap_map_mutex);

      HandleWrapper* handle = HandleWrapper::Get(copied_events[i]);
      if (!handle)
        continue;

      if (handle->canceled) {
        delete handle;
        continue;
      }

      DWORD bytes;
      if (GetOverlappedResult(handle->dir_handle,
                              &handle->overlapped,
                              &bytes,
                              FALSE) == FALSE)
        continue;

      std::vector<char> old_path;
      std::vector<WatcherEvent> events;

      DWORD offset = 0;
      while (true) {
        FILE_NOTIFY_INFORMATION* file_info =
            reinterpret_cast<FILE_NOTIFY_INFORMATION*>(handle->buffer + offset);

        // Emit events for children.
        EVENT_TYPE event = EVENT_NONE;
        switch (file_info->Action) {
          case FILE_ACTION_ADDED:
            event = EVENT_CHILD_CREATE;
            break;
          case FILE_ACTION_REMOVED:
            event = EVENT_CHILD_DELETE;
            break;
          case FILE_ACTION_RENAMED_OLD_NAME:
            event = EVENT_CHILD_RENAME;
            break;
          case FILE_ACTION_RENAMED_NEW_NAME:
            event = EVENT_CHILD_RENAME;
            break;
          case FILE_ACTION_MODIFIED:
            event = EVENT_CHILD_CHANGE;
            break;
        }

        if (event != EVENT_NONE) {
          // The FileNameLength is in "bytes", but the WideCharToMultiByte
          // requires the length to be in "characters"!
          int file_name_length_in_characters =
              file_info->FileNameLength / sizeof(wchar_t);

          char filename[MAX_PATH] = { 0 };
          int size = WideCharToMultiByte(CP_UTF8,
                                         0,
                                         file_info->FileName,
                                         file_name_length_in_characters,
                                         filename,
                                         MAX_PATH,
                                         NULL,
                                         NULL);

          // Convert file name to file path, same with:
          // path = handle->path + '\\' + filename
          std::vector<char> path(handle->path.size() + 1 + size);
          std::vector<char>::iterator iter = path.begin();
          iter = std::copy(handle->path.begin(), handle->path.end(), iter);
          *(iter++) = '\\';
          std::copy(filename, filename + size, iter);

          if (file_info->Action == FILE_ACTION_RENAMED_OLD_NAME) {
            // Do not send rename event until the NEW_NAME event, but still keep
            // a record of old name.
            old_path.swap(path);
          } else if (file_info->Action == FILE_ACTION_RENAMED_NEW_NAME) {
            WatcherEvent e = { event, handle->overlapped.hEvent };
            e.new_path.swap(path);
            e.old_path.swap(old_path);
            events.push_back(e);
          } else {
            WatcherEvent e = { event, handle->overlapped.hEvent };
            e.new_path.swap(path);
            events.push_back(e);
          }
        }

        if (file_info->NextEntryOffset == 0) break;
        offset += file_info->NextEntryOffset;
      }

      // Restart the monitor, it was reset after each call.
      QueueReaddirchanges(handle);

      locker.Unlock();

      for (size_t i = 0; i < events.size(); ++i)
        PostEventAndWait(events[i].type,
                         events[i].handle,
                         events[i].new_path,
                         events[i].old_path);
    }
  }
}

WatcherHandle PlatformWatch(const char* path) {
  wchar_t wpath[MAX_PATH] = { 0 };
  MultiByteToWideChar(CP_UTF8, 0, path, -1, wpath, MAX_PATH);

  // Requires a directory, file watching is emulated in js.
  DWORD attr = GetFileAttributesW(wpath);
  if (attr == INVALID_FILE_ATTRIBUTES || !(attr & FILE_ATTRIBUTE_DIRECTORY)) {
    fprintf(stderr, "%s is not a directory\n", path);
    return INVALID_HANDLE_VALUE;
  }

  WatcherHandle dir_handle = CreateFileW(wpath,
                                         FILE_LIST_DIRECTORY,
                                         FILE_SHARE_READ | FILE_SHARE_DELETE |
                                           FILE_SHARE_WRITE,
                                         NULL,
                                         OPEN_EXISTING,
                                         FILE_FLAG_BACKUP_SEMANTICS |
                                           FILE_FLAG_OVERLAPPED,
                                         NULL);
  if (!PlatformIsHandleValid(dir_handle)) {
    fprintf(stderr, "Unable to call CreateFileW for %s\n", path);
    return INVALID_HANDLE_VALUE;
  }

  std::unique_ptr<HandleWrapper> handle;
  {
    ScopedLocker locker(g_handle_wrap_map_mutex);
    handle.reset(new HandleWrapper(dir_handle, path));
  }

  if (!QueueReaddirchanges(handle.get())) {
    fprintf(stderr, "ReadDirectoryChangesW failed\n");
    return INVALID_HANDLE_VALUE;
  }

  // Wake up the thread to add the new event.
  SetEvent(g_wake_up_event);

  // The pointer is leaked if no error happened.
  return handle.release()->overlapped.hEvent;
}

void PlatformUnwatch(WatcherHandle key) {
  if (PlatformIsHandleValid(key)) {
    ScopedLocker locker(g_handle_wrap_map_mutex);

    HandleWrapper* handle = HandleWrapper::Get(key);
    handle->canceled = true;
    CancelIoEx(handle->dir_handle, &handle->overlapped);
    handle->CloseFile();
  }
}

bool PlatformIsHandleValid(WatcherHandle handle) {
  return handle != INVALID_HANDLE_VALUE;
}

bool PlatformIsEMFILE(WatcherHandle handle) {
  return false;
}
