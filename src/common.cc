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
#include "common.h"

static uv_async_t g_async;
static int g_watch_count;
static uv_sem_t g_semaphore;
static uv_thread_t g_thread;

static EVENT_TYPE g_type;
static WatcherHandle g_handle;
static std::vector<char> g_new_path;
static std::vector<char> g_old_path;
static Persistent<Function> g_callback;

static void CommonThread(void* handle) {
  WaitForMainThread();
  PlatformThread();
}

#if NODE_VERSION_AT_LEAST(0, 11, 13)
static void MakeCallbackInMainThread(uv_async_t* handle) {
#else
static void MakeCallbackInMainThread(uv_async_t* handle, int status) {
#endif
  NanScope();

  if (!g_callback.IsEmpty()) {
    Handle<String> type;
    switch (g_type) {
      case EVENT_CHANGE:
        type = NanNew("change");
        break;
      case EVENT_DELETE:
        type = NanNew("delete");
        break;
      case EVENT_RENAME:
        type = NanNew("rename");
        break;
      case EVENT_CHILD_CREATE:
        type = NanNew("child-create");
        break;
      case EVENT_CHILD_CHANGE:
        type = NanNew("child-change");
        break;
      case EVENT_CHILD_DELETE:
        type = NanNew("child-delete");
        break;
      case EVENT_CHILD_RENAME:
        type = NanNew("child-rename");
        break;
      default:
        type = NanNew("unknown");
        return;
    }

    Handle<Value> argv[] = {
        type,
        WatcherHandleToV8Value(g_handle),
        NanNew(std::string(g_new_path.begin(), g_new_path.end())),
        NanNew(std::string(g_old_path.begin(), g_old_path.end())),
    };
    NanNew(g_callback)->Call(NanGetCurrentContext()->Global(), 4, argv);
  }

  WakeupNewThread();
}

static void SetRef(bool value) {
  uv_handle_t* h = reinterpret_cast<uv_handle_t*>(&g_async);
  if (value) {
    uv_ref(h);
  } else {
    uv_unref(h);
  }
}

void CommonInit() {
  uv_sem_init(&g_semaphore, 0);
  uv_async_init(uv_default_loop(), &g_async, MakeCallbackInMainThread);
  // As long as any uv_ref'd uv_async_t handle remains active, the node
  // process will never exit, so we must call uv_unref here (#47).
  SetRef(false);
  g_watch_count = 0;
  uv_thread_create(&g_thread, &CommonThread, NULL);
}

void WaitForMainThread() {
  uv_sem_wait(&g_semaphore);
}

void WakeupNewThread() {
  uv_sem_post(&g_semaphore);
}

void PostEventAndWait(EVENT_TYPE type,
                      WatcherHandle handle,
                      const std::vector<char>& new_path,
                      const std::vector<char>& old_path) {
  // FIXME should not pass args by settings globals.
  g_type = type;
  g_handle = handle;
  g_new_path = new_path;
  g_old_path = old_path;

  uv_async_send(&g_async);
  WaitForMainThread();
}

NAN_METHOD(SetCallback) {
  NanScope();

  if (!args[0]->IsFunction())
    return NanThrowTypeError("Function required");

  NanAssignPersistent(g_callback, Local<Function>::Cast(args[0]));
  NanReturnUndefined();
}

NAN_METHOD(Watch) {
  NanScope();

  if (!args[0]->IsString())
    return NanThrowTypeError("String required");

  Handle<String> path = args[0]->ToString();
  WatcherHandle handle = PlatformWatch(*String::Utf8Value(path));
  if (PlatformIsEMFILE(handle))
    return NanThrowTypeError("EMFILE: Unable to watch path");
  if (!PlatformIsHandleValid(handle))
    return NanThrowTypeError("Unable to watch path");

  if (g_watch_count++ == 0) {
    SetRef(true);
  }

  NanReturnValue(WatcherHandleToV8Value(handle));
}

NAN_METHOD(Unwatch) {
  NanScope();

  if (!IsV8ValueWatcherHandle(args[0]))
    return NanThrowTypeError("Handle type required");

  PlatformUnwatch(V8ValueToWatcherHandle(args[0]));

  if (--g_watch_count == 0) {
    SetRef(false);
  }

  NanReturnUndefined();
}
