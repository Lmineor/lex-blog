---
title: "go_自旋锁"
date: 2023-06-18
slug: 2023-06-18-001
draft: false
tags: # 文章所属标签
  ["Go"]
categories: # 文章所属标签
  ["技术"]
---

# CAS 算法（compare and swap）

CAS 算法是一种有名的无锁算法。无锁编程，即不使用锁的情况下实现多线程之间的变量同步，也就是在没有线程被阻塞的情况下实现变量的同步，所以也叫非阻塞同步（Non-blocking Synchronization）。CAS 算法涉及到三个操作数:

- 需要读写的内存值 V
- 进行比较的值 A
- 拟写入的新值 B

当且仅当 V 的值等于 A 时,CAS 通过原子方式用新值 B 来更新 V 的值,否则不会执行任何操作(比较和替换是个原子操作).一般情况下是一个自旋操作,即不断的重试.

# 自旋锁

自旋锁是指当一个线程在获取锁的时候,如果锁已经被其他线程获取,那么该线程循环等待,然后不断地判断是否能被成功获取,知道获取到锁才会退出循环
获取锁的线程一直处于活跃状态，但是并没有执行任何有效的任务，使用这种锁会造成`busy-waiting`。
它是为实现保护共享资源而提出的一种锁机制。其实，自旋锁与互斥锁比较类似，它们都是为了解决某项资源的互斥使用。无论是互斥锁，还是自旋锁，在任何时刻，最多只能由一个保持者，也就说，在任何时刻最多只能有一个执行单元获得锁。但是两者在调度机制上略有不同。对于互斥锁，如果资源已经被占用，资源申请者只能进入睡眠状态。但是自旋锁不会引起调用者睡眠，如果自旋锁已经被别的执行单元保持，调用者就一直循环在那里看是否该自旋锁的保持者已经释放了锁，“自旋”一词就是因此而得名。

## 实现自旋锁

```go
type spinLock uint32
func (sl *spinLock) Lock() {
    for !atomic.CompareAndSwapUint32((*uint32)(sl), 0, 1) {
        runtime.Gosched()
    }
}
func (sl *spinLock) Unlock() {
    atomic.StoreUint32((*uint32)(sl), 0)
}
func NewSpinLock() sync.Locker {
    var lock spinLock
    return &lock
}
```

### 可重入自旋锁和不可重入自旋锁

上面的代码不支持重入,即当一个线程第一次已经获取到了该锁,在锁释放之前又一次重新获取该锁,第二次就不能成功获取到.由于不满足 cas,所以第二次会进入 for 循环等待,而如果是可重入锁,第二次也能得到锁.
为了实现可重入锁，要引入一个计数器，用来记录获取锁的线程数

```go
type spinLock struct {
	owner int
	count  int
	lock uint32
}

func (sl *spinLock) Lock() {
	me := GetGoroutineId()
	if sl .owner == me { // 如果当前线程已经获取到了锁，线程数增加一，然后返回
		sl.count++
		return
	}
	// 如果没获取到锁，则通过CAS自旋
	for !atomic.CompareAndSwapUint32(&sl.lock, 0, 1) {
		runtime.Gosched()
	}
	sl.owner = me
}
func (sl *spinLock) Unlock() {
	if  sl.owner != GetGoroutineId() {
		panic("illegalMonitorStateError")
	}
	if sl.count >0  { // 如果大于0，表示当前线程多次获取了该锁，释放锁通过count减一来模拟
		sl.count--
	}else { // 如果count==0，可以将锁释放，这样就能保证获取锁的次数与释放锁的次数是一致的了。
		atomic.StoreUint32(&sl.lock, 0)
	}
}

func GetGoroutineId() int {
	defer func()  {
		if err := recover(); err != nil {
			fmt.Printf("panic recover:panic info:%v\n", err)     }
	}()

	var buf [64]byte
	n := runtime.Stack(buf[:], false)
	idField := strings.Fields(strings.TrimPrefix(string(buf[:n]), "goroutine "))[0]
	id, err := strconv.Atoi(idField)
	if err != nil {
		panic(fmt.Sprintf("cannot get goroutine id: %v\n", err))
	}
	return id
}


func NewSpinLock() sync.Locker {
	var lock spinLock
	return &lock
}
```

# 自旋锁的其他变种

## 1. TicketLock

TicketLock 主要解决的是公平性的问题

思路:每当有线程获取锁的时候,就给该线程分配一个递增的 id,我们称之为排队号,同时,锁对应一个服务号,每当有线程释放锁,服务号就会递增,此时如果服务号与某个线程排队号一致,那么该线程就获得锁,由于排队号是递增的,所以就保证了最先请求获取锁的线程可以最先获得锁,就实现了公平性.

## 2. CLHLock

CLH 锁是一种基于链表的可扩展、高性能、公平的自旋锁，申请线程只在本地变量上自旋，它不断轮询前驱的状态，如果发现前驱释放了锁就结束自旋，获得锁。

## 3. MCSLock

MCSLock 则是对本地变量的节点进行循环。

## 4. CLHLock 和 MCSLock

都是基于链表，不同的是 CLHLock 是基于隐式链表，没有真正的后续节点属性，MCSLock 是显示链表，有一个指向后续节点的属性。
将获取锁的线程状态借助节点(node)保存,每个线程都有一份独立的节点，这样就解决了 TicketLock 多处理器缓存同步的问题。

# 自旋锁与互斥锁

自旋锁与互斥锁都是为了实现保护资源共享的机制。
无论是自旋锁还是互斥锁，在任意时刻，都最多只能有一个保持者。
获取互斥锁的线程，如果锁已经被占用，则该线程将进入睡眠状态；获取自旋锁的线程则不会睡眠，而是一直循环等待锁释放。

## 两种锁加锁原理

互斥锁:线程会从 sleep(加锁)-->running(解锁),过程中有上下文切换,cpu 的抢占,信号的发送等开销.
自旋锁:线程一直是 running(加锁-->解锁),死循环检测锁的标志位,机制不复杂.

互斥锁属于 sleep-waiting 类型的锁.例如在一个双核的机器上有两个线程(线程 A 和线程 B)，它们分别运行在 Core0 和 Core1 上。假设线程 A 想要通过 pthread_mutex_lock 操作去得到一个临界区的锁，而此时这个锁正被线程 B 所持有，那么线程 A 就会被阻塞 (blocking)，Core0 会在此时进行上下文切换(Context Switch)将线程 A 置于等待队列中，此时 Core0 就可以运行其他的任务(例如另一个线程 C)而不必进行忙等待。而自旋锁则不然，它属于 busy-waiting 类型的锁，如果线程 A 是使用 pthread_spin_lock 操作去请求锁，那么线程 A 就会一直在 Core0 上进行忙等待并不停的进行锁请求，直到得到这个锁为止.

## 两种锁的区别

互斥锁的起始开销要高于自旋锁,但基本是一劳永逸,临界区持锁时间的大小并不会对互斥锁的开销造成影响,而自旋锁是死循环检测,加锁过程全程消耗 cpu,起始开销虽然低于互斥锁,但随着持锁时间的增加,加锁的开销是线性增长.

## 两种锁的应用

互斥锁用于临界区持锁时间比较长的操作,比如下面这些情况都可以考虑

1. 临界区有 I/O 操作
2. 临界区代码复杂或者循环量大
3. 临界区竞争非常激烈
4. 单核处理器

至于自旋锁就主要用在临界区持锁时间非常短且 CPU 资源不紧张的情况下,自旋锁一般用于多核的服务器.

# 总结

- 自旋锁：线程获取锁的时候，如果锁被其他线程持有，则当前线程将循环等待，直到获取到锁。
- 自旋锁等待期间，线程的状态不会改变，线程一直是用户态并且是活动的(active)。
- 自旋锁如果持有锁的时间太长，则会导致其它等待获取锁的线程耗尽 CPU。
- 自旋锁本身无法保证公平性，同时也无法保证可重入性。
- 基于自旋锁，可以实现具备公平性和可重入性质的锁。
- TicketLock:采用类似银行排号叫好的方式实现自旋锁的公平性，但是由于不停的读取 serviceNum，每次读写操作都必须在多个处理器缓存之间进行缓存同步，这会导致繁重的系统总线和内存的流量，大大降低系统整体的性能。
- CLHLock 和 MCSLock 通过链表的方式避免了减少了处理器缓存同步，极大的提高了性能，区别在 CLHLock 是通过轮询其前驱节点的状态，而 MCS 则是查看当前节点的锁状态。
- CLHLock 在 NUMA 架构下使用会存在问题。在没有 cache 的 NUMA 系统架构中，由于 CLHLock 是在当前节点的前一个节点上自旋,NUMA 架构中处理器访问本地内存的速度高于通过网络访问其他节点的内存，所以 CLHLock 在 NUMA 架构上不是最优的自旋锁。
