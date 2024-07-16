---
title: "关于锁的一些注意事项"
date: 2022-10-19
slug: 2022-10-19-001
draft: false
tags: # 文章所属标签
  ["go"]
categories: # 文章所属标签
  ["技术"]
---

# 尽量减少锁的持有时间

- 细化锁的粒度。通过细化锁的粒度来减少锁的持有时间以及避免在持有锁操作的时候做各种耗时的操作。
- 不要在持有锁的时候做 IO 操作。尽量只通过持有锁来保护 **IO 操作需要的资源**而不是 **IO 操作本身**：

```go

func doSomething() {
    m.Lock()
    item := ...
    http.Get()  // 各种耗时的 IO 操作
    m.Unlock()
}

// 改为
func doSomething() {
    m.Lock()
    item := ...
    m.Unlock()

    http.Get()
}
```

# 善用 defer 来确保在函数内正确释放

通过 defer 可以确保不会遗漏释放锁操作，避免出现死锁问题，以及避免函数内非预期的 panic 导致死锁的问题
不过使用 defer 的时候也要注意别因为习惯性的 defer m.Unlock() 导致无意中在持有锁的时候做了 IO 操作，出现了非预期的持有锁时间太长的问题。

```go
// 非预期的在持有锁期间做 IO 操作
func doSomething() {
    m.Lock()
    defer m.Unlock()

    item := ...
    http.Get()  // 各种耗时的 IO 操作
}
```

# 在适当时候使用 RWMutex

当确定操作不会修改保护的资源时，可以使用 RWMutex 来减少锁等待时间（不同的 goroutine 可以同时持有 RLock, 但是 Lock 限制了只能有一个 goroutine 持有 Lock）：

```go
func nickName() string {
    rw.RLock()
    defer rw.RUnlock()

    return name
}

func SetName(s string) string {
    rw.Lock()
    defer rw.Unlock()

    name = s
}
```

# copy 结构体操作可能导致非预期的死锁

copy 结构体时，如果结构体中有锁的话，记得重新初始化一个锁对象，否则会出现非预期的死锁：

````go
package main

 import (
     "fmt"
     "sync"
 )

 type User struct {
     sync.Mutex

     name string
 }

 func main() {
     u1 := &User{name: "test"}
     u1.Lock()
     defer u1.Unlock()

     tmp := *u1
     u2 := &tmp
     // u2.Mutex = sync.Mutex{} // 没有这一行就会死锁

     fmt.Printf("%#p\n", u1)
     fmt.Printf("%#p\n", u2)

     u2.Lock()
     defer u2.Unlock()
 }```


参考：

[Go: 关于锁（mutex）的一些使用注意事项 - Huang Huang 的博客 (mozillazg.com)](https://mozillazg.com/2019/04/notes-about-go-lock-mutex.html)
````
