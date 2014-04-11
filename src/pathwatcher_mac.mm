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

#include <errno.h>
#include <unistd.h>
#include <sys/event.h>
#include <sys/param.h>
#include <sys/time.h>
#include <sys/types.h>

#include "common.h"

static int g_kqueue;

void PlatformInit() {
  g_kqueue = kqueue();

  WakeupNewThread();
}

void PlatformThread() {
  struct kevent event;

  while (true) {
    int r;
    do {
      r = kevent(g_kqueue, NULL, 0, &event, 1, NULL);
    } while ((r == -1 && errno == EINTR) || r == 0);

    EVENT_TYPE type;
    int fd = static_cast<int>(event.ident);
    std::vector<char> path;

    if (event.fflags & NOTE_WRITE) {
      type = EVENT_CHANGE;
    } else if (event.fflags & NOTE_DELETE) {
      type = EVENT_DELETE;
    } else if (event.fflags & NOTE_RENAME) {
      type = EVENT_RENAME;
      char buffer[MAXPATHLEN] = { 0 };
      fcntl(fd, F_GETPATH, buffer);
      close(fd);

      int length = strlen(buffer);
      path.resize(length);
      std::copy(buffer, buffer + length, path.data());
    } else {
      continue;
    }

    PostEventAndWait(type, fd, path);
  }
}

WatcherHandle PlatformWatch(const char* path) {
  int fd = open(path, O_EVTONLY, 0);
  if (fd < 0) {
    // TODO: Maybe this could be handled better?
    return -(errno);
  }

  struct timespec timeout = { 0, 0 };
  struct kevent event;
  int filter = EVFILT_VNODE;
  int flags = EV_ADD | EV_ENABLE | EV_CLEAR;
  int fflags = NOTE_WRITE | NOTE_DELETE | NOTE_RENAME;
  EV_SET(&event, fd, filter, flags, fflags, 0, (void*)path);
  kevent(g_kqueue, &event, 1, NULL, 0, &timeout);

  return fd;
}

void PlatformUnwatch(WatcherHandle fd) {
  close(fd);
}

bool PlatformIsHandleValid(WatcherHandle handle) {
  return handle >= 0;
}

bool PlatformIsEMFILE(WatcherHandle handle) {
  return handle == -24;
}
