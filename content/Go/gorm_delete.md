---
title: "gorm删除记录（删除具有级联关系的数据）"
date: 2022-11-18
slug: 2022-11-18-001
draft: false
tags: # 文章所属标签
  ["Go"]
categories: # 文章所属标签
  ["技术"]
---

# 删除具有级联关系的数据

参考：https://gorm.io/zh_CN/docs/associations.html#Association-Mode

## 带 Select 的删除

你可以在删除记录时通过 Select 来删除具有 has one、has many、many2many 关系的记录，例如：

```go

// 删除 user 时，也删除 user 的 account
db.Select("Account").Delete(&user)

// 删除 user 时，也删除 user 的 Orders、CreditCards 记录
db.Select("Orders", "CreditCards").Delete(&user)

// 删除 user 时，也删除用户所有 has one/many、many2many 记录
db.Select(clause.Associations).Delete(&user)

// 删除 users 时，也删除每一个 user 的 account
db.Select("Account").Delete(&users)

```

注意：只有当记录的主键不为空时，关联才会被删除，GORM 会使用这些主键作为条件来删除关联记录

```go
// DOESN'T WORK
db.Select("Account").Where("name = ?", "jinzhu").Delete(&User{})
// 会删除所有 name=`jinzhu` 的 user，但这些 user 的 account 不会被删除

db.Select("Account").Where("name = ?", "jinzhu").Delete(&User{ID: 1})
// 会删除 name = `jinzhu` 且 id = `1` 的 user，并且 user `1` 的 account 也会被删除

db.Select("Account").Delete(&User{ID: 1})
// 会删除 id = `1` 的 user，并且 user `1` 的 account 也会被删除

```
