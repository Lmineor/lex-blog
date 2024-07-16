---
title: "Go实现不同goroutine之间的阻塞"
date: 2022-10-12
slug: 2022-10-12-002
draft: false
tags: # 文章所属标签
  ["go"]
categories: # 文章所属标签
  ["技术"]
---

Go 程序从 main 包的 `main()` 函数开始，在程序启动时，Go 程序就会为 `main()` 函数创建一个默认的 `goroutine`。

所有 `goroutine` 在 `main()` 函数结束时会一同结束。
若在启用的`goroutine`中不使用`WaitGroup`的话会因为 main 函数已执行完，阻塞的函数与发送信号的函数会一同结束，不能真正实现阻塞的功能。

因此可以使用`WaitGroup`来实现阻塞的功能。

如下为不加`WaitGroup`时的版本

```go
package main

import (
	"fmt"
	"time"
)

var closeCh = make(chan struct{})

func main() {
	// var wg sync.WaitGroup
	fmt.Println("start main func")

	// wg.Add(1)
	go func() {
		fmt.Println("waiting for signal")
		<-closeCh
		fmt.Println("got signal.")
		// wg.Done()
	}()

	// wg.Add(1)
	go func() {
		fmt.Println("preparing for signal:")
		for i := 0; i < 3; i++ {
			fmt.Println(">>>>")
			time.Sleep(time.Second * 1)
		}
		closeCh <- struct{}{}
		fmt.Println("sent signal.")
		// wg.Done()
	}()
	// wg.Wait()
}
```

执行结果

```go
start main func // 只打印输出了这么一行
```

如下为加`WaitGroup`时的版本

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

var closeCh = make(chan struct{})

func main() {
	var wg sync.WaitGroup
	fmt.Println("start main func")

	wg.Add(1)
	go func() {
		fmt.Println("waiting for signal")
		<-closeCh
		fmt.Println("got signal.")
		wg.Done()
	}()

	wg.Add(1)
	go func() {
		fmt.Println("preparing for signal:")
		for i := 0; i < 3; i++ {
			fmt.Println(">>>>")
			time.Sleep(time.Second * 1)
		}
		closeCh <- struct{}{}
		fmt.Println("sent signal.")
		wg.Done()
	}()
	wg.Wait()
}

```

执行结果：

```go
start main func
preparing for signal:
>>>>
waiting for signal
>>>>
>>>>
got signal.
sent signal.
```

参考：
http://c.biancheng.net/view/93.html
