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
#ifndef SRC_COMMON_H_
#define SRC_COMMON_H_

#include <vector>

#include "nan.h"
using namespace v8;

#ifdef _WIN32
// Platform-dependent definetion of handle.
typedef HANDLE WatcherHandle;

// Conversion between V8 value and WatcherHandle.
Handle<Value> WatcherHandleToV8Value(WatcherHandle handle);
WatcherHandle V8ValueToWatcherHandle(Handle<Value> value);
bool IsV8ValueWatcherHandle(Handle<Value> value);
#else
// Correspoding definetions on OS X and Linux.
typedef int32_t WatcherHandle;
#define WatcherHandleToV8Value(h) Integer::New(h)
#define V8ValueToWatcherHandle(v) v->Int32Value()
#define IsV8ValueWatcherHandle(v) v->IsInt32()
#endif

void PlatformInit();
void PlatformThread();
WatcherHandle PlatformWatch(const char* path);
void PlatformUnwatch(WatcherHandle handle);
bool PlatformIsHandleValid(WatcherHandle handle);
bool PlatformIsEMFILE(WatcherHandle handle);

enum EVENT_TYPE {
  EVENT_NONE,
  EVENT_CHANGE,
  EVENT_RENAME,
  EVENT_DELETE,
  EVENT_CHILD_CHANGE,
  EVENT_CHILD_RENAME,
  EVENT_CHILD_DELETE,
  EVENT_CHILD_CREATE,
};

void WaitForMainThread();
void WakeupNewThread();
void PostEventAndWait(EVENT_TYPE type,
                      WatcherHandle handle,
                      const std::vector<char>& new_path,
                      const std::vector<char>& old_path = std::vector<char>());

void CommonInit();

NAN_METHOD(SetCallback);
NAN_METHOD(Watch);
NAN_METHOD(Unwatch);

#endif  // SRC_COMMON_H_
