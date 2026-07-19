---
title: 'Antigravity安装与探索'
description: '记录在国内环境下安装和登录谷歌 Antigravity agent 的完整过程，以及代理配置、账号轮换、Antigravity IDE 等探索经验。'
author: 'HaxiLin'
pubDate: 2026-07-18
tags: ["antigravity", "ai", "proxy", "tools"]
---

今天主要研究了一下 **Antigravity**，这是谷歌推出的 agent。在国内使用还是非常麻烦，下面就来介绍我是怎么安装并跑通登录的。

## 一、下载与安装

首先从官网获取安装包。Antigravity 安装时**没有提供自定义安装路径的选项**，默认会直接落在 C 盘。如果你介意的话，安装完成后还得自己迁移目录、做好索引和快捷方式的修正。

## 二、登录问题：最大的拦路虎

安装完后，真正的麻烦才刚开始——登录。

Antigravity 的登录方式是「给一个链接让你网页登录」，但网页登录完成后，链接还要发回本地再经历一遍校验。问题就出在这里：我的 VPN 只开了普通代理而不是全局代理，本地端根本连不上网络去完成验证。

### 1. 使用 Antigravity-proxy

于是我找到了 [Antigravity-proxy](https://github.com/)，这个 GitHub 项目提供了一个 HTML 版的 `setting.json` 生成工具。使用流程是：

1. 找到你 VPN 的**代理端口**和**代理方式**（`http` / `socks5`）；
2. 用工具生成对应的 `setting.json`；
3. 把 `setting.json` 放进 Antigravity 的根目录下；
4. 重新启动 Antigravity。

### 2. 定位代理端口：CPorts

因为我用的并不是 v2ray 等常见代理工具，所以还得自己去找端口（如果是这些常见工具，直接开全局代理或 tun 代理就没我这么多麻烦事了）。

这时候我又发现了一个新工具——**CPorts**。这个免费工具非常方便，能把所有端口占用全部显示出来，包括对应的应用、状态等等，给出了很多重要信息。我就是在其中找到了对应的端口。

### 3. 协议试错：http 还是 socks5？

到这里还有一个问题：我没有搞懂 Antigravity 需要的是哪种协议，而且我的 VPN 一共有**两个向下的端口**，所以只能都尝试一下，只有一组是对的。

这两个端口其实就分别对应着 `http` 和 `socks5`。最后验证下来：**Antigravity 需要的是 http 协议**。

到这一步，基本就都完成了，能够成功登陆。

## 三、延伸工具

在折腾的过程中，我还顺带发现了几个有用的工具：

- **Antigravity tools**：因为 Google 账号提供的免费额度特别少，借助这个工具可以快速切换账号、轮换使用，功能还是很强大的。
- **proxybridge**：因为我遇到了「需要全局代理」的问题，所以又找到了这个工具——它能够强制某个应用走代理，省去全局代理的配置。

## 四、Antigravity IDE：尚未攻克

Antigravity 与别的 agent 不同的是，它还有自己的 IDE——**Antigravity IDE**。

不过这个 IDE 我下载下来并没有登录成功。按理来说它也应该和 Antigravity 本体一样，通过「网页登录 → 本地登录」的方式完成认证，但我复制了 Antigravity 本体的那一套操作还是失败了，也不知道是不是没有代理上。

具体表现是：

- **Antigravity 本体**：点击登录后会自动跳转到「等待认证」界面，流程正常；
- **Antigravity IDE**：点击登录后一直停留在欢迎界面，没有跳转。

这一块还得继续研究，等有了进展再更新。

## 小结

整条链路下来，在国内用上 Antigravity 的关键卡点其实就是：

1. 安装路径无法自定义 → 手动迁移；
2. 普通代理下登录回调走不通 → 用 Antigravity-proxy 配 `setting.json`；
3. 端口和协议不确定 → 用 CPorts 查端口，http/socks5 逐个试；
4. 免费额度吃紧 → 用 Antigravity tools 轮换账号。

希望这篇记录能帮到同样在折腾 Antigravity 的朋友。
