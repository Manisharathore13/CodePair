# CodePair — Real-Time Collaborative Code Editor

CodePair is a web-based collaborative coding platform where users can create coding rooms, join using a room code, write code together in real time, and execute programs in supported programming languages.

## Features

- **Create Coding Rooms:** Create rooms for collaborative coding.
- **Join with Room Code:** Join an existing room using its unique code.
- **Real-Time Collaboration:** Share code changes between users in the same room.
- **Language Synchronization:** Synchronize the selected programming language between collaborators.
- **Monaco Code Editor:** Write and edit code in a familiar coding interface.
- **Multi-Language Execution:** Run code in C++, Java, Python, and JavaScript, subject to the configured execution service.
- **Custom Input:** Provide standard input (stdin) to programs.
- **Execution Output:** View program output and reported errors.
- **Database Integration:** Store and retrieve rooms using PostgreSQL.

## Screenshots

### Home Page
![CodePair Home Page](screenshots/home-page.png)

### Code Editor
![CodePair Editor](screenshots/editor.png)

### Live Collaboration
![CodePair Live Collaboration](screenshots/collaboration.png)

### Code Execution Output
![CodePair Code Output](screenshots/code-output.png)

## Tech Stack

- **Frontend:** React, Vite, CSS, Monaco Editor
- **Backend:** Node.js, Express.js
- **Real-Time Communication:** Socket.IO
- **Database:** PostgreSQL
- **Code Execution:** Judge0 API

## Project Structure

```text
CodePair/
├── client/          # React frontend
├── server/          # Node.js backend
├── screenshots/     # Project screenshots
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL
- A configured code-execution API connection

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd CodePair
```

Replace the placeholder with your actual GitHub repository URL.

### 2. Set Up the Backend

```bash
cd server
npm install
```

Create or configure `server/.env` with the environment variables required by your backend, including database connection details and code-execution API configuration.

**Never commit API keys, database passwords, or other secrets to GitHub.**

Start the backend:

```bash
node index.js
```

### 3. Set Up the Frontend

Open a second terminal in the project root and run:

```bash
cd client
npm install
npm run dev
```

Open the local URL displayed by Vite, usually:

```text
http://localhost:5173/
```

Keep both the backend and frontend running while using the application.

## How to Use

1. Open CodePair in your browser.
2. Create a coding room or join one using its room code.
3. Open the same room in another browser window to test collaboration.
4. Type code and check whether changes appear in the other window.
5. Change the programming language and verify synchronization.
6. Enter custom input if required and click **Run Code**.
7. Check the output or any reported errors.

## Future Improvements

- User authentication and personalized workspaces
- Improved room access controls
- More robust collaboration and connection recovery
- Cloud deployment and production monitoring

## Project Goal

CodePair aims to make collaborative programming practice easier by combining real-time code sharing, language synchronization, and program execution in one workspace.
