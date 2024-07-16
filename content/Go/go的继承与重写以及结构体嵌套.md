---
title: "Go的继承与重写以及结构体嵌套"
date: 2022-10-12
slug: 2022-10-12-001
draft: false
tags: # 文章所属标签
  ["go"]
categories: # 文章所属标签
  ["技术"]
---

## 1. 首先声明两个基础结构体（其他语言的基类吧:)）

```go
type Animal struct {
	Name string
}

type Old struct {
	Age int
}
```

并给`Animal`类增加一个方法`Walk()`

```go
func (a *Animal) Walk() {
	fmt.Println("Animal Walk")
}
```

## 2. 让`People`类嵌套（继承）上面的`Animal`和`Old`类

这时可以有两种匿名嵌套（继承）方式

- 嵌套结构体指针
- 嵌套结构体

```go
 // 匿名嵌套，而且嵌套的是一个结构体指针
type People struct {
	*Animal
	Old
}
// 匿名嵌套，而且嵌套的是一个结构体
type People struct {
	Animal
	Old
}
```

非匿名嵌套的方式不太优雅

```go
type People struct {
	Animal Animal //非匿名嵌套Animal结构体
	Old
}
```

## 3. new 一个 People

```go
func NewPeople() *People {
	return &People{
		Animal: &Animal{Name: "bok"}, //嵌套结构体指针的方式，嵌套结构体时改成Animal: Animal{Name: "bok"} 即可
		Old:    Old{Age: 18},
	}
}
```

## 4. 访问`Walk()`方法

```go
people := NewPeople()
people.Animal.Walk() // 访问父类的Walk
people.Walk() // 访问自己的Walk方法（从父类Animal那里继承过来的）
// Animal Walk
// Animal Walk
```

## 5. 重写父类`Walk()`方法

```go
func (p *People) Walk() {
	fmt.Println("Poeple Walk")
}
```

```go
people := NewPeople()
people.Animal.Walk() // 访问父类的Walk
people.Walk() // 访问自己的Walk方法（重写父类的Walk方法）
// Animal Walk
// Poeple Walk
```

## 6. 完整代码

```go
package main

import "fmt"

type Animal struct {
	Name string
}

type Old struct {
	Age int
}

func (a *Animal) Walk() {
	fmt.Println("Animal Walk")
}

type People struct {
	*Animal
	Old
}

func (p *People) Walk() {
	fmt.Println("Poeple Walk")
}

func NewPeople() *People {
	return &People{
		Animal: &Animal{Name: "bok"},
		Old:    Old{Age: 18},
	}
}

func main() {
	people := NewPeople()
	people.Animal.Walk()
	people.Walk()
	fmt.Println(people.Age)
	fmt.Println(people.Name)
	fmt.Printf("New people %v \n", people)
}
```
