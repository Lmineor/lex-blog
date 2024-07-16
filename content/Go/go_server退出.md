---
title: "go server退出"
date: 2023-09-03
slug: 2023-09-03-001
draft: false
tags: # 文章所属标签
  ["Go"]
categories: # 文章所属标签
  ["技术"]
---

# go server 以相当优雅的姿势退出（待继续完善）

```bash
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type H struct{}

func (H) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	time.Sleep(5 * time.Second)
	fmt.Fprintf(w, "Hello, World!") // 向客户端发送响应
}

func initServer() *http.Server {
	s := &http.Server{
		Addr:    ":8080",
		Handler: H{},
	}
	return s
}

type Backend struct {
	Ctx context.Context
	Srv *http.Server

	CancelFunc func()
}

var onlyOneSignalHandler = make(chan struct{})
var shutdownSignals = []os.Signal{os.Interrupt, syscall.SIGTERM}
var shutdownHandler chan os.Signal

// SetupSignalContext is same as SetupSignalHandler, but a context.Context is returned.
// Only one of SetupSignalContext and SetupSignalHandler should be called, and only can
// be called once.
func (b *Backend) SetupSignalContext() context.Context {
	close(onlyOneSignalHandler) // panics when called twice

	shutdownHandler = make(chan os.Signal, 2)

	signal.Notify(shutdownHandler, shutdownSignals...)

	go func() {
		<-shutdownHandler
		b.Clean()
		<-shutdownHandler
		os.Exit(1) // second signal. Exit directly.
	}()

	return b.Ctx
}

// SetupSignalHandler registered for SIGTERM and SIGINT. A stop channel is returned
// which is closed on one of these signals. If a second signal is caught, the program
// is terminated with exit code 1.
// Only one of SetupSignalContext and SetupSignalHandler should be called, and only can
// be called once.
func (b *Backend) SetupSignalHandler() <-chan struct{} {
	return b.SetupSignalContext().Done()
}

func (b *Backend) RunAndServe(stopCh <-chan struct{}) {
	b.Srv.ListenAndServe()
	<-stopCh
	if err := b.Srv.Shutdown(b.Ctx); err != nil {
		log.Fatal("Server Shutdown:", err)
	}
	log.Printf("initServer exiting")
}

func (b *Backend) Clean() {
	fmt.Println("do some clean")
	time.Sleep(time.Second * 10)
	b.CancelFunc()
	fmt.Println("clean over")
	b.Ctx.Done()
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	simpleBackend := Backend{
		Ctx:        ctx,
		Srv:        initServer(),
		CancelFunc: cancel,
	}
	simpleBackend.RunAndServe(simpleBackend.SetupSignalHandler())
}

```
