# Real-Time Chat Backend (WebSockets)

A backend service built to get hands-on experience with **WebSockets**, **real-time messaging**, and **presence tracking**.

---

## 🔧 Tech Stack

- Node.js
- WebSockets
- PostgreSQL
- Prisma
- Redis

---

## 🏗️ Overview

This project implements a real-time chat backend using WebSockets alongside a traditional HTTP API.

It supports:
- Real-time messaging
- Room-based chat
- Typing indicators
- Online/offline presence tracking
- Message history persistence

---

## 💬 WebSocket Features

Supported real-time events:
- Join and leave chat rooms
- Send messages to a room
- Typing start notifications
- Global user online/offline presence

Messages are persisted before being broadcast.

---

## 🌐 HTTP Endpoints

- Fetch paginated message history for a room
- Fetch currently online users

These endpoints complement the real-time WebSocket layer.

---

## 📦 Data Storage

- Chat messages are stored in PostgreSQL
- Redis is used for:
  - Pub/sub fanout
  - Online user tracking
  - Rate limiting
  - Ephemeral real-time signals

---

## 🧱 Architecture

- Combined HTTP + WebSocket server
- In-memory room membership per server instance
- Redis used for cross-process coordination
- Prisma used for database access

---

## 🎯 Purpose

This project was built to practice:

- WebSocket server fundamentals
- Real-time event handling
- Presence and typing indicators
- Mixing HTTP APIs with WebSockets
- Redis usage in real-time systems

---

