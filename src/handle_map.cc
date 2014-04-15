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
#include "handle_map.h"

#include <algorithm>

HandleMap::HandleMap() {
}

HandleMap::~HandleMap() {
  Clear();
}

bool HandleMap::Has(WatcherHandle key) const {
  return map_.find(key) != map_.end();
}

bool HandleMap::Erase(WatcherHandle key) {
  Map::iterator iter = map_.find(key);
  if (iter == map_.end())
    return false;

  NanDispose(iter->second); // Deprecated, use NanDisposePersistent when v0.12 lands
  map_.erase(iter);
  return true;
}

void HandleMap::Clear() {
  for (Map::iterator iter = map_.begin(); iter != map_.end(); ++iter)
    NanDispose(iter->second); // Deprecated, use NanDisposePersistent when v0.12 lands
  map_.clear();
}

// static
NAN_METHOD(HandleMap::New) {
  NanScope();
  HandleMap* obj = new HandleMap();
  obj->Wrap(args.This());
  NanReturnUndefined();
}

// static
NAN_METHOD(HandleMap::Add) {
  NanScope();

  if (!IsV8ValueWatcherHandle(args[0]))
    return NanThrowTypeError("Bad argument");

  HandleMap* obj = ObjectWrap::Unwrap<HandleMap>(args.This());
  WatcherHandle key = V8ValueToWatcherHandle(args[0]);
  if (obj->Has(key))
    return NanThrowError("Duplicate key");

  NanAssignUnsafePersistent(Value, obj->map_[key], args[1]);
  NanReturnUndefined();
}

// static
NAN_METHOD(HandleMap::Get) {
  NanScope();

  if (!IsV8ValueWatcherHandle(args[0]))
    return NanThrowTypeError("Bad argument");

  HandleMap* obj = ObjectWrap::Unwrap<HandleMap>(args.This());
  WatcherHandle key = V8ValueToWatcherHandle(args[0]);
  if (!obj->Has(key))
    return NanThrowError("Invalid key");

  NanReturnValue(NanPersistentToLocal(obj->map_[key]));
}

// static
NAN_METHOD(HandleMap::Has) {
  NanScope();

  if (!IsV8ValueWatcherHandle(args[0]))
    return NanThrowTypeError("Bad argument");

  HandleMap* obj = ObjectWrap::Unwrap<HandleMap>(args.This());
  NanReturnValue(Boolean::New(obj->Has(V8ValueToWatcherHandle(args[0]))));
}

// static
NAN_METHOD(HandleMap::Values) {
  NanScope();

  HandleMap* obj = ObjectWrap::Unwrap<HandleMap>(args.This());

  int i = 0;
  Handle<Array> keys = Array::New(obj->map_.size());
  for (Map::const_iterator iter = obj->map_.begin();
       iter != obj->map_.end();
       ++iter, ++i)
    keys->Set(i, NanPersistentToLocal(iter->second));

  NanReturnValue(keys);
}

// static
NAN_METHOD(HandleMap::Remove) {
  NanScope();

  if (!IsV8ValueWatcherHandle(args[0]))
    return NanThrowTypeError("Bad argument");

  HandleMap* obj = ObjectWrap::Unwrap<HandleMap>(args.This());
  if (!obj->Erase(V8ValueToWatcherHandle(args[0])))
    return NanThrowError("Invalid key");

  NanReturnUndefined();
}

// static
NAN_METHOD(HandleMap::Clear) {
  NanScope();

  HandleMap* obj = ObjectWrap::Unwrap<HandleMap>(args.This());
  obj->Clear();

  NanReturnUndefined();
}

// static
void HandleMap::Initialize(Handle<Object> target) {
  NanScope();

  Local<FunctionTemplate> t = FunctionTemplate::New(HandleMap::New);
  t->InstanceTemplate()->SetInternalFieldCount(1);
  t->SetClassName(NanSymbol("HandleMap"));

  NODE_SET_PROTOTYPE_METHOD(t, "add", Add);
  NODE_SET_PROTOTYPE_METHOD(t, "get", Get);
  NODE_SET_PROTOTYPE_METHOD(t, "has", Has);
  NODE_SET_PROTOTYPE_METHOD(t, "values", Values);
  NODE_SET_PROTOTYPE_METHOD(t, "remove", Remove);
  NODE_SET_PROTOTYPE_METHOD(t, "clear", Clear);

  target->Set(NanSymbol("HandleMap"), t->GetFunction());
}
