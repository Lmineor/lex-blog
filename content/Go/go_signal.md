---
title: "go signal处理"
date: 2022-10-23
slug: 2022-10-23-001
draft: false
tags: # 文章所属标签
  ["go"]
categories: # 文章所属标签
  ["技术"]
---

# Go Signal 信号处理

参考: [Go Signal 信号处理]([(17 条消息) Go Signal 信号处理\_无风的雨-CSDN 博客\_go signal](https://blog.csdn.net/guyan0319/article/details/90240731))

可以先参考官方资料[go.signal]([signal package - os/signal - pkg.go.dev](https://pkg.go.dev/os/signal))

# 前言

信号(Signal)是 Linux, 类 Unix 和其它 POSIX 兼容的操作系统中用来进程间通讯的一种方式。对于 Linux 系统来说，信号就是软中断，用来通知进程发生了异步事件。

当信号发送到某个进程中时，操作系统会中断该进程的正常流程，并进入相应的信号处理函数执行操作，完成后再回到中断的地方继续执行。

有时候我们想在 Go 程序中处理 Signal 信号，比如收到 SIGTERM 信号后优雅的关闭程序，以及 goroutine 结束通知等。

Go 语言提供了对信号处理的包（os/signal）。

Go 中对信号的处理主要使用 os/signal 包中的两个方法：一个是`notify`方法用来监听收到的信号；一个是` stop`方法用来取消监听。

Go 信号通知机制可以通过往一个 channel 中发送 os.Signal 实现。

# 信号类型

各平台的信号定义或许有些不同。下面列出了 POSIX 中定义的信号。
Linux 使用 34-64 信号用作实时系统中。命令 man signal 提供了官方的信号介绍。在 POSIX.1-1990 标准中定义的信号列表

需要特别说明的是，SIGKILL 和 SIGSTOP 这两个信号既不能被应用程序捕获，也不能被操作系统阻塞或忽略。

```go
// main.go

package main

import "fmt"
import "os"
import "os/signal"
import "syscall"

func main() {

   // 创建一个os.Signal channel
   sigs := make(chan os.Signal, 1)
   //创建一个bool channel
   done := make(chan bool, 1)

	//注册要接收的信号，syscall.SIGINT:接收ctrl+c ,syscall.SIGTERM:程序退出
	//信号没有信号参数表示接收所有的信号
   signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

     //此goroutine为执行阻塞接收信号。一旦有了它，它就会打印出来。
    //然后通知程序可以完成。
   go func() {
      sig := <-sigs
      fmt.Println(sig)
      done <- true
   }()

   //程序将在此处等待，直到它预期信号（如Goroutine所示）
   //在“done”上发送一个值，然后退出。
   fmt.Println("awaiting signal")
   <-done
   fmt.Println("exiting")
}
```

执行 go run main.go 再敲入 ctrl+c，程序会输出

```bash
awaiting signal
interrupt
exiting
```

如果用 kill pid 结束程序，则输出

```bash
awaiting signal
Terminated
```
