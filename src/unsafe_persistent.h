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
#ifndef UNSAFE_PERSISTENT_H_
#define UNSAFE_PERSISTENT_H_

#include "nan.h"

#if NODE_VERSION_AT_LEAST(0, 11, 0)
template<class T>
struct NanUnsafePersistentTraits {
  typedef v8::Persistent<T, NanUnsafePersistentTraits<T> > HandleType;
  static const bool kResetInDestructor = false;
  template<class S, class M>
  static V8_INLINE void Copy(const Persistent<S, M>& source, 
                             HandleType* dest) {
    // do nothing, just allow copy
  }
};

template<class T>
class NanUnsafePersistent : public NanUnsafePersistentTraits<T>::HandleType {
  public:
    V8_INLINE NanUnsafePersistent() {}
    template <class S>
      V8_INLINE NanUnsafePersistent(v8::Isolate* isolate, S that)
        : NanUnsafePersistentTraits<T>::HandleType(isolate, that) {}
};

template<typename T>
  NAN_INLINE void NanAssignUnsafePersistent(
    NanUnsafePersistent<T>& handle
    , v8::Handle<T> obj) {
    handle.Reset();
    handle = NanUnsafePersistent<T>(v8::Isolate::GetCurrent(), obj);
}

template<typename T>
  NAN_INLINE v8::Local<T> NanUnsafePersistentToLocal(const NanUnsafePersistent<T> &arg1) {
    return v8::Local<T>::New(v8::Isolate::GetCurrent(), arg1);
  }

#define NanDisposeUnsafePersistent(handle) handle.Reset()
#else
#define NanUnsafePersistent v8::Persistent
#define NanAssignUnsafePersistent NanAssignPersistent
#define NanUnsafePersistentToLocal NanNew
#define NanDisposeUnsafePersistent NanDisposePersistent
#endif

#endif  // UNSAFE_PERSISTENT_H_
