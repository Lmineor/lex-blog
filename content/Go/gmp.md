---
title: "GMP"
date: 2023-11-12
slug: 2023-11-12-001
draft: false
tags: # 文章所属标签
  ["Go"]
categories: # 文章所属标签
  ["技术"]
---

非原创

> 好文：https://yizhi.ren/2019/06/03/goscheduler

> 参考：https://blog.csdn.net/xmcy001122/article/details/119392934

# Go 语言的协程 goroutine

Go 为了提供更容易使用的并发方法，使用了 goroutine 和 channel。goroutine 来自协程的概念，让一组可复用的函数运行在一组线程之上，即使有协程阻塞，该线程的其他协程也可以被 runtime 调度，转移到其他可运行的线程上。最关键的是，程序员看不到这些底层的细节，这就降低了编程的难度，提供了更容易的并发。

Go 中，协程被称为 goroutine，它非常轻量，一个 goroutine 只占几 KB，并且这几 KB 就足够 goroutine 运行完，这就能在有限的内存空间内支持大量 goroutine，支持了更多的并发。虽然一个 goroutine 的栈只占几 KB，但实际是可伸缩的，如果需要更多内容，runtime 会自动为 goroutine 分配。

Goroutine 特点：

- 占用内存更小（2KB 左右，系统线程需要 1-8MB）
- 调度更灵活（runtime 调度）

# 调度器

## 被废弃的 goroutine 调度器 - GM 模型

Go 目前使用的调度器是 2012 年重新设计的，因为之前的调度器性能存在问题，所以使用 4 年就被废弃了，那么我们先来分析一下被废弃的调度器是如何运作的？

Go 的调度程序是 Go 运行时的一个更重要的方面。运行时会跟踪每个 Goroutine，并将安排它们在线程池中运行。goroutines 与线程分离（解耦不强绑定），但运行于线程之上。如何有效地将 goroutine 调度到线程上对于 go 程序的高性能至关重要。

Goroutines 的背后逻辑是：它们能够同时运行，与线程类似，但相比之下非常轻量。因此，程序运行时，Goroutines 的个数应该是远大于线程的个数的。

同时多线程在程序中是很有必要的，因为当 goroutine 调用了一个阻塞的系统调用，比如 sleep，那么运行这个 goroutine 的线程就会被阻塞，那么这时运行时至少应该再创建一个线程来运行别的没有阻塞的 goroutine。线程这里可以创建不止一个，可以按需不断地创建，而活跃的线程（处于非阻塞状态的线程）的最大个数存储在变量 GOMAXPROCS 中。

### 简要说明

go 运行时使用 3 个结构来跟踪所有成员来支持调度器的工作。

G 的结构：

一个 G 代表一个 goroutine，包含当前栈，当前状态和函数体。

```c
struct G
{
byte∗ stackguard; // stack guard information
byte∗ stackbase; // base of stack
byte∗ stack0; // current stack pointer
byte∗ entry; // initial function
void∗ param; // passed parameter on wakeup
int16 status; // status
int32 goid; // unique id
M∗ lockedm; // used for locking M’s and G’s
...
}
```

M:

一个 M 代表一个线程，包含全局 G 队列，当前 G，内存等。

```c
struct M
{
G∗ curg; // current running goroutine
int32 id; // unique id
int32 locks ; // locks held by this M
MCache ∗mcache; // cache for this thread
G∗ lockedg; // used for locking M’s and G’s
uintptr createstack [32]; // Stack that created this thread
M∗ nextwaitm; // next M waiting for lock
...
};
```

SCHED:

SCHED 是全局单例，用来跟踪 G 队列和 M 队列，和维护其他一些信息。

```c
struct Sched {
Lock; // global sched lock .
// must be held to edit G or M queues
G ∗gfree; // available g’ s ( status == Gdead)
G ∗ghead; // g’ s waiting to run queue
G ∗gtail; // tail of g’ s waiting to run queue
int32 gwait; // number of g’s waiting to run
int32 gcount; // number of g’s that are alive
int32 grunning; // number of g’s running on cpu
// or in syscall
M ∗mhead; // m’s waiting for work
int32 mwait; // number of m’s waiting for work
int32 mcount; // number of m’s that have been created
...
};
```

GM 调度模型：

- G：Goroutine 的缩写，每次 go func() 都代表一个 G，无限制，但受内存影响。使用 struct runtime.g，包含了当前 goroutine 的状态、堆栈、上下文
- M：工作线程(OS thread)也被称为 Machine，使用 struct runtime.m，所有 M 是有线程栈的。M 的默认数量限制是 10000（来源），可以通过 debug.SetMaxThreads 修改。

![gm](https://www.mineor.xyz/images/20231112/gm.jpg)

运行时刚启动时会启动一些 G,其中一个负责垃圾回收，其中一个负责调度，其中一个负责用户的入口函数。一开始运行时只有一个 M 被创建，随后，用户层面的更多 G 被创建，然后更多的 M 被创建出来执行更多的 G。同时最多同时支持 GOMAXPROCS 个活跃的线程。

M 代表一个线程，M 需要从全局 G 队列中取出一个 G 并且执行 G 对应的代码，如果 G 代码执行阻塞的系统调用，那么会首先从空闲的 M 队列中取出一个 M 唤醒，随后执行阻塞调用，陷入阻塞。这么做是因为线程阻塞后，活跃的线程数肯定就小于 GOMAXPROCS 了，这时我们就可以增加一个活跃的线程以防止当前有 G 在等在 M。

造成阻塞的都是系统调用，在调用返回之前，线程会一直阻塞。但是注意，M 不会在 channel 的操作中阻塞，这是因为操作系统并不知道 channel，channel 的所有的操作都是有运行时来处理的。所以如果 goroutine 执行了 channel 操作，这时 goroutine 可能会需要阻塞，但是这个阻塞不是操作系统带来的阻塞，因此 M 并不需要一起阻塞。这种场景下，这个 G 会被标记为 waiting，然后原来执行这个 G 的 M 会继续去执行别的 G。waiting 的 G 在 channel 操作完成后会设为 runable 状态，并把自己放回到原来那个 q 的队列下，等待空闲的 M 来执行，不一定是先前那个 M 了。为了完成 g 的唤醒，waitting 的这个 g 必然会在 wating 前先找个地方某个字段某个数组保存。

M 想要执行、放回 G 都必须访问全局 G 队列，并且 M 有多个，即多线程访问同一资源需要加锁进行保证互斥 / 同步，所以全局 G 队列是有互斥锁进行保护的。

### 老调度器有几个缺点：

- 单一全局互斥锁(Sched.Lock)和集中状态存储。导致所有 goroutine 相关操作，比如：创建、结束、重新调度等都要上锁。
- Goroutine 传递问题。M 经常在 M 之间传递”可运行”的 goroutine，这导致调度延迟增大以及额外的性能损耗（刚创建的 G 放到了全局队列，而不是本地 M 执行，不必要的开销和延迟）
- 每一个 M 现在都持有一个内存，包括了阻塞状态的 M 也是持有的。Active 状态的 M 跟总的 M 个数之比可以达到 1:100。这就导致了过多的内存消耗，以及较差的数据局部性。数据局部性怎么理解呢？数据局部性这里是指 G 当前在 M 运行后对 M 的内存进行了预热，后面如果再次调度到同一个 M 那么可以加速访问，可想而知，因为现在 G 调度到同一个 M 的概率不高，所以数据局部性不好。
- 严重的线程阻塞/解锁。在系统调用的情况下，工作线程经常被阻塞和取消阻塞，这增加了很多开销。比如 M 找不到 G，此时 M 就会进入频繁阻塞/唤醒来进行检查的逻辑，以便及时发现新的 G 来执行。

GM 模型存在的问题在：Dmitry Vyukov “Scalable Go Scheduler Design Doc”有详细描述，推荐阅读

## 新调度器

### 调度器细节

Dmitry Vyukov 的方案是引入一个结构 P，用来模拟处理器，M 依旧表示操作系统线程，G 依旧表示一个 goroutine。

GOMAXPROCS 用来控制 P 的个数，同时 P 作为 M 执行 G 代码时的必需资源。

新的 P 结构会带走原来的 M 和 SCHED 结构中的一些属性，比如 MCache 从 M 移到了 P，而 G 队列也被分成两类，SCHED 结构保留全局 G 队列，同时每个 P 中都会有一个本地的 G 队列。

![newGmp](https://www.mineor.xyz/images/20231112/newGmp.jpg)

P 的本地队列可以解决旧调度器中单一全局锁的问题。注意 P 的本地 G 队列还是可能面临一个并发访问的场景，比如下面讲到的窃取算法。为了避免加锁，这里 P 的本地队列是一个 LockFree 的队列，窃取 G 时使用 CAS 原子操作来完成。关于 LockFree 和 CAS 的知识参见[Lock-Free](https://yizhi.ren/2017/09/19/reorder/)。

### 调用过程

1. 创建一个 G 对象
2. 如果还有空闲的的 P，创建一个 M
3. M 会启动一个底层线程，循环执行能找到的 G
4. G 的执行顺序是先从本地队列找，本地没找到从全局队列找。一次性转移(全局 G 个数/P 个数）个，再去其它 P 中找（窃取算法（stealing algorithm）)
5. 当 P 执行系统调用即将阻塞时，M 会释放 P，并进入阻塞，直到系统调用返回时，M 会尝试获取空闲的 P，有的话继续执行，没有就把 G 会放到全局 G，而 M 会进入空闲的 M 队列。
   以上的 G 任务是按照队列顺序执行（也就是 go 函数的调用顺序）。
   另外在启动时会有一个专门的 sysmon 来监控和管理，记录所有 P 的 G 任务计数 schedtick。如果某个 P 的 schedtick 一直没有递增，说明这个 P 一直在执行一个 G 任务，如果超过一定时间就会为 G 增加标记，并且该 G 执行非内联函数时中断自己并把自己加到队尾。

### 新调度器中引入了线程自旋

自旋有好处有坏处，好处是避免线程被阻塞陷入内核，坏处是自旋属于空转，浪费 CPU。只能说适度使用自旋是可以带来好处的。新方案在两个地方引入自旋：

1，M 找不到 P（目的是一有 P 释放就结合）

2，M 找到了 P 但找不到 G（目的是一有 runable 的 G 就执行）
