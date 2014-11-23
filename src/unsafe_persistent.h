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
template<typename TypeName> class NanUnsafePersistent {
 public:
  NanUnsafePersistent() : value(0) { }
  explicit NanUnsafePersistent(v8::Persistent<TypeName>* handle) {
    value = handle->ClearAndLeak();
  }
  explicit NanUnsafePersistent(const v8::Local<TypeName>& handle) {
    v8::Persistent<TypeName> persistent(nan_isolate, handle);
    value = persistent.ClearAndLeak();
  }

  NAN_INLINE(v8::Persistent<TypeName>* persistent()) {
    v8::Persistent<TypeName>* handle = reinterpret_cast<v8::Persistent<TypeName>*>(&value);
    return handle;
  }

  NAN_INLINE(void Dispose()) {
    NanDispose(*persistent());
    value = 0;
  }

  NAN_INLINE(void Clear()) {
    value = 0;
  }

  NAN_INLINE(v8::Local<TypeName> NewLocal()) {
    return v8::Local<TypeName>::New(nan_isolate, *persistent());
  }

  NAN_INLINE(bool IsEmpty() const) {
    return value;
  }

 private:
  TypeName* value;
};
#define NanAssignUnsafePersistent(type, handle, obj)                          \
  handle = NanUnsafePersistent<type>(obj)
template<class T> static NAN_INLINE(void NanDispose(
    NanUnsafePersistent<T> &handle
)) {
  handle.Dispose();
  handle.Clear();
}
template <class TypeName>
static NAN_INLINE(v8::Local<TypeName> NanPersistentToLocal(
   const NanUnsafePersistent<TypeName>& persistent
)) {
  return const_cast<NanUnsafePersistent<TypeName>&>(persistent).NewLocal();
}
#else
#define NanUnsafePersistent v8::Persistent
#define NanAssignUnsafePersistent NanAssignPersistent
#endif

#endif  // UNSAFE_PERSISTENT_H_
