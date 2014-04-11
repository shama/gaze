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
#ifndef SRC_HANDLE_MAP_H_
#define SRC_HANDLE_MAP_H_

#include <map>

#include "common.h"
#include "unsafe_persistent.h"

class HandleMap : public node::ObjectWrap {
 public:
  static void Initialize(Handle<Object> target);

 private:
  typedef std::map<WatcherHandle, NanUnsafePersistent<Value> > Map;

  HandleMap();
  virtual ~HandleMap();

  bool Has(WatcherHandle key) const;
  bool Erase(WatcherHandle key);
  void Clear();

  static void DisposeHandle(NanUnsafePersistent<Value>& value);

  static NAN_METHOD(New);
  static NAN_METHOD(Add);
  static NAN_METHOD(Get);
  static NAN_METHOD(Has);
  static NAN_METHOD(Values);
  static NAN_METHOD(Remove);
  static NAN_METHOD(Clear);

  Map map_;
};

#endif  // SRC_HANDLE_MAP_H_
