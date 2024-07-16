---
title: "学习一下sync.Cond的用法"
date: 2022-10-19
slug: 2022-10-19-001
draft: false
tags: # 文章所属标签
  ["go"]
categories: # 文章所属标签
  ["技术"]
---

使用场景：  
我需要完成一项任务，但是这项任务需要满足一定条件才可以执行，否则我就等着。  
那我可以怎么获取这个条件呢？一种是循环去获取，一种是条件满足的时候通知我就可以了。显然第二种效率高很多。  
通知的方式的话，golang 里面通知可以用 channel 的方式

```go
	var mail = make(chan string)
    go func() {
        <- mail
        fmt.Println("get chance to do something")
    }()
    time.Sleep(5*time.Second)
    mail <- "moximoxi"
```

但是 channel 的方式还是比较适合一对一，一对多并不是很适合。下面就来介绍一下另一种方式：`sync.Cond  `
`sync.Cond`就是用于实现条件变量的，是基于 sync.Mutex 的基础上，增加了一个通知队列，通知的线程会从通知队列中唤醒一个或多个被通知的线程。  
主要有以下几个方法：

```go
	sync.NewCond(&mutex)：生成一个cond，需要传入一个mutex，因为阻塞等待通知的操作以及通知解除阻塞的操作就是基于sync.Mutex来实现的。
	sync.Wait()：用于等待通知
	sync.Signal()：用于发送单个通知
	sync.Broadcat()：用于广播
```

先找到一个 sync.Cond 的基本用法

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

var locker sync.Mutex
var cond = sync.NewCond(&locker)

// NewCond(l Locker)里面定义的是一个接口,拥有lock和unlock方法。
// 看到sync.Mutex的方法,func (m *Mutex) Lock(),可以看到是指针有这两个方法,所以应该传递的是指针
func main() {
	for i := 0; i < 10; i++ {
		go func(x int) {
			cond.L.Lock()         // 获取锁
			defer cond.L.Unlock() // 释放锁
			cond.Wait()           // 等待通知，阻塞当前 goroutine
			// 通知到来的时候, cond.Wait()就会结束阻塞, do something. 这里仅打印
			fmt.Println(x)
		}(i)
	}
	time.Sleep(time.Second * 1) // 睡眠 1 秒，等待所有 goroutine 进入 Wait 阻塞状态
	fmt.Println("Signal...")
	cond.Signal() // 1 秒后下发一个通知给已经获取锁的 goroutine
	time.Sleep(time.Second * 1)
	fmt.Println("Signal...")
	cond.Signal() // 1 秒后下发下一个通知给已经获取锁的 goroutine
	time.Sleep(time.Second * 1)
	cond.Broadcast() // 1 秒后下发广播给所有等待的goroutine
	fmt.Println("Broadcast...")
	time.Sleep(time.Second * 5) // 睡眠 1 秒，等待所有 goroutine 执行完毕

}
```

上述代码实现了主线程对多个 goroutine 的通知的功能。  
抛出一个问题：  
主线程执行的时候，如果并不想触发所有的协程，想让不同的协程可以有自己的触发条件，应该怎么使用？  
下面就是一个具体的需求：  
有四个 worker 和一个 master，worker 等待 master 去分配指令，master 一直在计数，计数到 5 的时候通知第一个 worker，计数到 10 的时候通知第二个和第三个 worker。  
首先列出几种解决方式  
1、所有 worker 循环去查看 master 的计数值，计数值满足自己条件的时候，触发操作 >>>>>>>>>弊端：无谓的消耗资源  
2、用 channel 来实现，几个 worker 几个 channel，eg:worker1 的协程里<-channel(worker1)进行阻塞，计数值到 5 的时候，给 worker1 的 channel 放入值，  
阻塞解除，worker1 开始工作。 >>>>>>>弊端：channel 还是比较适用于一对一的场景，一对多的时候，需要起很多的 channel，不是很美观  
3、用条件变量 sync.Cond，针对多个 worker 的话，用 broadcast，就会通知到所有的 worker。

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

func main() {

	mutex := sync.Mutex{}
	var cond = sync.NewCond(&mutex)
	mail := 1
	go func() {
		for count := 0; count <= 15; count++ {
			time.Sleep(time.Second)
			mail = count
			cond.Broadcast()
		}
	}()
	// worker1
	go func() {
		for mail != 5 { // 触发的条件，如果不等于5，就会进入cond.Wait()等待，此时cond.Broadcast()通知进来的时候，wait阻塞解除，进入下一个循环，此时发现mail != 5，跳出循环，开始工作。
			cond.L.Lock()
			cond.Wait()
			cond.L.Unlock()
		}
		fmt.Println("worker1 started to work")
		time.Sleep(3 * time.Second)
		fmt.Println("worker1 work end")
	}()
	// worker2
	go func() {
		for mail != 10 {
			cond.L.Lock()
			cond.Wait()
			cond.L.Unlock()
		}
		fmt.Println("worker2 started to work")
		time.Sleep(3 * time.Second)
		fmt.Println("worker2 work end")
	}()
	// worker3
	go func() {
		for mail != 10 {
			cond.L.Lock()
			cond.Wait()
			cond.L.Unlock()
		}
		fmt.Println("worker3 started to work")
		time.Sleep(3 * time.Second)
		fmt.Println("worker3 work end")
	}()

	time.Sleep(20 * time.Second)
}
```
