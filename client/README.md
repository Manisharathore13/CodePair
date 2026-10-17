# CodePair — Real-Time Collaborative Code Editor

CodePair is a web-based collaborative coding platform that allows users to create coding rooms, join using a unique room code, write code together in real time, and execute programs in multiple programming languages. It combines live collaboration, an interactive code editor, and code execution in one workspace.

## Features

- **User Authentication:** Sign up and log in to access the platform.
- **Create Coding Rooms:** Create rooms for collaborative programming.
- **Join with Room Code:** Join an existing coding room using its unique room code.
- **Real-Time Collaboration:** Share code changes between users in the same room.
- **Language Synchronization:** Synchronize the selected programming language between collaborators.
- **Monaco Code Editor:** Write and edit code using the Monaco Editor.
- **Multi-Language Execution:** Execute programs in supported languages such as C++, Java, Python, and JavaScript through the configured code execution service.
- **Custom Input:** Provide standard input (stdin) to programs.
- **Execution Output:** View program output, errors, and execution status.
- **Submission History:** Save and review previous code executions, including code, language, input, output, and execution status.
- **PostgreSQL Integration:** Store user, room, and submission data in a PostgreSQL database.
- **Responsive Dark UI:** Use a dark-themed interface designed for a focused coding experience.

## Screenshots

### Home Page

![CodePair Home Page](screenshots/home-page.png)

### Code Editor

![CodePair Code Editor](screenshots/editor.png)

### Live Collaboration

![CodePair Live Collaboration](screenshots/collaboration.png)

### Code Execution Output and Submission History

![CodePair Code Execution and History](screenshots/code-output.png)

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS
- Monaco Editor

### Backend
- Node.js
- Express.js
- REST APIs

### Real-Time Communication
- Socket.IO

### Database
- PostgreSQL

### Code Execution
- Judge0 API

### Development Tools
- Visual Studio Code
- Git and GitHub
- npm

## Project Structure

```text
CodePair/
├── client/              # React frontend
├── server/              # Node.js and Express backend
├── screenshots/         # Project screenshots
└── README.md             # Project documentation
```

## Getting Started

### Prerequisites

Make sure the following are installed:

- Node.js and npm
- PostgreSQL
- Git
- A configured Judge0 API connection

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd CodePair
```

Replace `<YOUR_GITHUB_REPOSITORY_URL>` with your actual GitHub repository URL.

### 2. Set Up the Backend

Open a terminal and run:

```bash
cd server
npm install
```

Configure the required environment variables in `server/.env`. These may include database connection details, authentication secrets, and code execution API settings, depending on the backend implementation.

**Important:** Never commit `.env` files, API keys, database passwords, JWT secrets, or other credentials to GitHub.

Start the backend:

```bash
node index.js
```

The backend runs on the configured port, which is typically `5000` in the local development setup.

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
2. Sign up or log in to your account.
3. Create a coding room or join an existing room using its room code.
4. Open the same room in another browser window to test real-time collaboration.
5. Write code in the Monaco Editor and verify that changes appear in the other session.
6. Change the programming language and check whether it synchronizes between collaborators.
7. Enter custom input if required.
8. Click **Run Code** to execute the program.
9. Review the execution output, errors, and status.
10. Open **Submission History** to review previous executions and restore a saved submission when needed.

## Key Learning Outcomes

- Building a full-stack web application using React and Node.js.
- Implementing real-time communication using Socket.IO.
- Designing and integrating REST APIs.
- Connecting a backend to PostgreSQL.
- Implementing user authentication and protected API routes.
- Integrating an external code execution service.
- Managing application state and asynchronous API requests.
- Using Git and GitHub for version control.

## Future Improvements

- Room access controls and participant permissions.
- Improved collaboration and connection recovery.
- Cloud deployment and production monitoring.
- Additional execution metrics and testing capabilities.
- Enhanced error handling and application security.

## Project Goal

CodePair aims to make collaborative programming practice easier by combining real-time code sharing, synchronized programming languages, code execution, and submission history in a single workspace.

---

**Built with React, Node.js, Socket.IO, PostgreSQL, and Judge0.**