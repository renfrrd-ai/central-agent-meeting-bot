# PRD - Autonomous Meeting Bot System (Vexa.ai)

## Overview

Vexa.ai is an autonomous meeting bot system that automatically joins online meetings through event-driven triggers.

Supported platforms:

* Google Meet
* Zoom
* Microsoft Teams

Supported execution modes:

* **Easy Mode:** Direct meeting URL triggers bot join
* **Advanced Mode:** Email/calendar invite automatically triggers bot

---

# Problem

Current meeting bots are manual, unreliable, and require human intervention.

The system should:

* Automatically react to meeting invitations
* Remove manual bot launching
* Maintain persistent authentication
* Reliably join meetings autonomously

---

# Goals

* Auto-join meetings from URLs or invites
* Support Meet, Zoom, and Teams
* Use Vexa.ai as orchestration layer
* Maintain persistent bot identity/session
* Ensure reliable unattended joining

---

# Non-Goals

* AI summaries or analytics in v1
* Full dashboard/UI
* Real-time collaboration tools

---

# Architecture

Trigger → Listener → Orchestrator → Meeting Bot → Meeting Platform

---

# Core Components

## 1. Trigger Layer

Sources:

* Meeting URL
* Email/calendar invitation

---

## 2. Email Listener

* Monitors bot inbox
* Detects invites
* Extracts meeting links
* Sends events to orchestrator

---

## 3. Vexa Orchestrator

* Central control system
* Handles all triggers
* Launches bot sessions

---

## 4. Meeting Bot Engine

Responsibilities:

* Open meeting
* Authenticate session
* Join call
* Handle prompts and waiting rooms

Uses Vexa runtime with Playwright fallback.

---

## 5. Authentication Layer

* Persistent login sessions
* Secure cookie/session storage
* Prevent repeated logins

---

# Execution Flows

## Easy Mode

1. User submits meeting URL
2. API triggers orchestrator
3. Bot launches and joins

---

## Advanced Mode

1. User invites bot email
2. Listener detects invite
3. Link extracted
4. Orchestrator launches bot
5. Bot joins automatically

---

# Functional Requirements

* Accept meeting URLs via API
* Monitor inbox for invites
* Extract valid meeting links
* Launch autonomous bots
* Persist authentication state
* Log lifecycle events and failures

---

# Constraints

* Node.js + TypeScript
* Must handle unstable meeting UIs
* Headless/semi-headless browser support
* Reliability prioritized over complexity

---

# Success Criteria

* Successful joins from URL triggers
* Successful joins from email invites
* No repeated manual login
* Reliable event detection
* Recoverable/logged failures

---

# Future Enhancements

* AI meeting assistant
* Transcripts
* Multi-bot scaling
* Calendar integrations
* Admin dashboard

---

# Summary

An event-driven autonomous bot platform where URLs or meeting invitations trigger bots that automatically join Meet, Zoom, or Teams sessions through Vexa orchestration.
