---
title: "互斥锁"
date: 2022-10-19
slug: 2022-10-19-001
draft: false
tags: # 文章所属标签
  ["go"]
categories: # 文章所属标签
  ["技术"]
---

# 互斥锁

用一个互斥锁来在 Go 协程间安全的访问数据

```go
package main

import (
	"fmt"
	"math/rand"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	var state = make(map[int]int)
	var mutex = &sync.Mutex{}
	var ops int64 = 0
	for r := 0; r < 100; r++ {
		// 运行100个go协程来重复读取state
		go func() {
			total := 0
			for {
				key := rand.Intn(5)
				mutex.Lock()
				total += state[key]
				mutex.Unlock()
				atomic.AddInt64(&ops, 1)
				runtime.Gosched() // 为了确保这个Go协程不会在调度中饿死，我们在每次操作后明确的使用runtime.Gosched()进行释放。是自动处理的。
			}
		}()
	}
	for w := 0; w < 10; w++ { // 模拟写入操作
		go func() {
			for {
				key := rand.Intn(5)
				val := rand.Intn(100)
				mutex.Lock()
				state[key] = val
				mutex.Unlock()
				atomic.AddInt64(&ops, 1)
				runtime.Gosched()
			}
		}()
	}
	time.Sleep(time.Second)
	opsFinal := atomic.LoadInt64(&ops)
	fmt.Println("ops:", opsFinal)
	mutex.Lock() //对 state 使用一个最终的锁，显示它是如何结束的。
	fmt.Println("state:", state)
	mutex.Unlock()
}


```
