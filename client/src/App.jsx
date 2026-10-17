
import { useEffect, useRef, useState } from "react";
import "./App.css";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";

const API = "http://localhost:5000";

function getToken() {
  return localStorage.getItem("codepair_token");
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  };
}

function App() {
  const [serverStatus, setServerStatus] = useState("Checking...");
  const [authMode, setAuthMode] = useState("login");

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(getToken())
  );

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("codepair_user") || "null");
    } catch {
      return null;
    }
  });

  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [roomName, setRoomName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [rooms, setRooms] = useState([]);
  const [message, setMessage] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);

  const [code, setCode] = useState("// Start coding here...\n");
  const [language, setLanguage] = useState("cpp");
  const [customInput, setCustomInput] = useState("");
  const [output, setOutput] = useState("");
  const [runError, setRunError] = useState("");
  const [runStatus, setRunStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const socketRef = useRef(null);

  function handleLogout() {
    localStorage.removeItem("codepair_token");
    localStorage.removeItem("codepair_user");

    socketRef.current?.disconnect();
    socketRef.current = null;

    setCurrentUser(null);
    setIsAuthenticated(false);
    setActiveRoom(null);
    setRooms([]);
    setMessage("Please log in to continue.");
    setAuthPassword("");
    setAuthMode("login");
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setMessage("");
    setAuthLoading(true);

    try {
      const isSignup = authMode === "signup";

      const response = await fetch(
        `${API}/api/auth/${isSignup ? "signup" : "login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isSignup
              ? {
                  name: authName.trim(),
                  email: authEmail.trim(),
                  password: authPassword,
                }
              : {
                  email: authEmail.trim(),
                  password: authPassword,
                }
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      if (!isSignup && data.token && data.user) {
        localStorage.setItem("codepair_token", data.token);
        localStorage.setItem("codepair_user", JSON.stringify(data.user));

        setCurrentUser(data.user);
        setRooms([]);
        setActiveRoom(null);
        setIsAuthenticated(true);
        setAuthPassword("");
        setMessage(`Welcome, ${data.user.name}!`);
      } else if (isSignup) {
        setAuthMode("login");
        setAuthPassword("");
        setMessage("Account created! Please log in.");
      }
    } catch (error) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setAuthLoading(false);
    }
  }

  // Check backend status
  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Server request failed");
        }
        return response.json();
      })
      .then((data) => {
        setServerStatus(data.success ? "Connected" : "Unavailable");
      })
      .catch(() => {
        setServerStatus("Disconnected");
      });
  }, []);

  // Load rooms after login and whenever authentication changes
  useEffect(() => {
    if (!isAuthenticated) {
      setRooms([]);
      return;
    }

    let cancelled = false;

    async function loadRooms() {
      try {
        const response = await fetch(`${API}/api/rooms`, {
          headers: authHeaders(),
        });

        if (response.status === 401) {
          if (!cancelled) handleLogout();
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load rooms.");
        }

        if (!cancelled) {
          setRooms(data.rooms || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error.message || "Failed to load rooms.");
        }
      }
    }

    loadRooms();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Connect to Socket.IO with JWT when a room is opened
  useEffect(() => {
    if (!isAuthenticated || !activeRoom) return;

    const token = getToken();

    if (!token) {
      handleLogout();
      return;
    }

    const connection = io(API, {
      auth: { token },
    });

    socketRef.current = connection;

    connection.on("connect", () => {
      connection.emit("join-room", activeRoom.id);
      setMessage(`Connected to room ${activeRoom.id}`);
    });

    connection.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);

      if (
        error.message.toLowerCase().includes("token") ||
        error.message.toLowerCase().includes("authentication")
      ) {
        handleLogout();
      } else {
        setMessage(
          "Live connection failed. Check whether the backend is running."
        );
      }
    });

    connection.on("code-update", (updatedCode) => {
      setCode(updatedCode);
    });

    connection.on("room-state", (state) => {
      if (state.roomCode !== activeRoom.id) return;

      setCode(state.code ?? "// Start coding here...\n");
      setLanguage(state.language ?? "cpp");
    });

    connection.on("language-update", (updatedLanguage) => {
      setLanguage(updatedLanguage);
    });

    connection.on("room-deleted", ({ roomCode: deletedCode }) => {
      if (deletedCode !== activeRoom.id) return;

      setActiveRoom(null);
      setRooms((currentRooms) =>
        currentRooms.filter((room) => room.id !== deletedCode)
      );
      setMessage("This room has been deleted.");
    });

    connection.on("room-not-found", () => {
      setActiveRoom(null);
      setMessage("Room not found. It may have been deleted.");
    });

    return () => {
      connection.disconnect();

      if (socketRef.current === connection) {
        socketRef.current = null;
      }
    };
  }, [activeRoom, isAuthenticated]);

  function openRoom(room) {
    setCode("// Start coding here...\n");
    setActiveRoom(room);
    setMessage(`Opening ${room.name}...`);
  }

  // Create room — authentication required
  async function createRoom(event) {
    event.preventDefault();

    const name = roomName.trim();

    if (!name) {
      setMessage("Please enter a room name.");
      return;
    }

    try {
      const response = await fetch(`${API}/api/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not create room.");
      }

      setRooms((currentRooms) => [
        data.room,
        ...currentRooms.filter((room) => room.id !== data.room.id),
      ]);

      setRoomName("");
      openRoom(data.room);
    } catch (error) {
      setMessage(error.message || "Unable to connect to the server.");
    }
  }

  // Find and join a room — authentication required
  async function joinRoom(event) {
    event.preventDefault();

    const room = roomCode.trim().toUpperCase();

    if (!room) {
      setMessage("Please enter a room code.");
      return;
    }

    setIsJoining(true);

    try {
      const response = await fetch(
        `${API}/api/rooms/${encodeURIComponent(room)}`,
        {
          headers: authHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Room not found.");
      }

      setRooms((currentRooms) => [
        data.room,
        ...currentRooms.filter((item) => item.id !== data.room.id),
      ]);

      setRoomCode("");
      openRoom(data.room);
    } catch (error) {
      setMessage(error.message || "Unable to connect to the server.");
    } finally {
      setIsJoining(false);
    }
  }

  // Update editor and broadcast code changes
  function handleCodeChange(value) {
    const updatedCode = value ?? "";

    setCode(updatedCode);

    if (socketRef.current?.connected && activeRoom) {
      socketRef.current.emit("code-change", {
        roomCode: activeRoom.id,
        code: updatedCode,
      });
    }
  }

  function handleLanguageChange(nextLanguage) {
    setLanguage(nextLanguage);

    if (socketRef.current?.connected && activeRoom) {
      socketRef.current.emit("language-change", {
        roomCode: activeRoom.id,
        language: nextLanguage,
      });
    }
  }

  // Run code using Judge0 backend endpoint
  async function handleRunCode() {
    setIsRunning(true);
    setOutput("");
    setRunError("");
    setRunStatus("Running...");

    try {
      const response = await fetch(`${API}/api/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language,
          input: customInput,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Code execution failed.");
      }

      setOutput(data.output || "");
      setRunError(data.error || "");
      setRunStatus(data.status || "Finished");
    } catch (error) {
      setRunError(error.message || "Unable to run code.");
      setRunStatus("Failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function copyRoomCode(roomId) {
    try {
      await navigator.clipboard.writeText(roomId);
      setMessage(`Room code ${roomId} copied!`);
    } catch {
      setMessage("Could not copy the code. Please copy it manually.");
    }
  }

  // Delete room — authentication required
  async function deleteRoom(room) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${room.name}"?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API}/api/rooms/${encodeURIComponent(room.id)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete room.");
      }

      setRooms((currentRooms) =>
        currentRooms.filter((item) => item.id !== room.id)
      );

      if (activeRoom?.id === room.id) {
        setActiveRoom(null);
      }

      setMessage(`Room "${room.name}" deleted successfully.`);
    } catch (error) {
      setMessage(error.message || "Unable to delete room.");
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-screen">
        <a className="brand auth-brand" href="/">
          CodePair<span>.</span>
        </a>

        <section className="auth-card">
          <div className="auth-logo">{"{}"}</div>
          <p className="eyebrow">CODE TOGETHER</p>

          <h1>
            {authMode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p className="auth-subtitle">
            {authMode === "login"
              ? "Log in to continue your coding journey."
              : "Join your teammates and start coding together."}
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setMessage("");
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={authMode === "signup" ? "active" : ""}
              onClick={() => {
                setAuthMode("signup");
                setMessage("");
              }}
            >
              Sign up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === "signup" && (
              <>
                <label htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  type="text"
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </>
            )}

            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={8}
              required
            />

            {message && (
              <p className="auth-message" role="status">
                {message}
              </p>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={authLoading}
            >
              {authLoading
                ? "Please wait..."
                : authMode === "login"
                ? "Log in →"
                : "Create account →"}
            </button>
          </form>

          <p className="auth-switch">
            {authMode === "login"
              ? "New to CodePair?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setAuthMode(
                  authMode === "login" ? "signup" : "login"
                );
                setMessage("");
              }}
            >
              {authMode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
        </section>

        <p className="auth-footer">
          CodePair · Collaborate. Code. Create.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="navbar">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            setActiveRoom(null);
            setMessage("");
          }}
        >
          CodePair<span>.</span>
        </a>

        <div className="nav-right">
          <span className="status">
            <span
              className={`status-dot ${
                serverStatus === "Connected" ? "online" : ""
              }`}
            />
            API: {serverStatus}
          </span>

          <div className="avatar">
            {(currentUser?.name || "U").charAt(0).toUpperCase()}
          </div>

         
<button
  className="logout-button"
  type="button"
  onClick={handleLogout}
>
  Logout
</button>

        </div>
      </header>

      <main className="main">
        {!activeRoom ? (
          <>
            <section className="welcome">
              <p className="eyebrow">COLLABORATE. CODE. CREATE.</p>
              <h1>
                Build something great, <span>together.</span>
              </h1>
              <p className="subtitle">
                Create a coding room or join a session to practice coding
                interviews with your teammates.
              </p>
            </section>

            <section className="actions">
              <article className="panel">
                <div className="panel-icon">＋</div>
                <h2>Create a room</h2>
                <p>Start a new collaborative coding session.</p>

                <form onSubmit={createRoom}>
                  <label htmlFor="roomName">Room name</label>
                  <input
                    id="roomName"
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder="e.g. DSA Practice"
                    maxLength={50}
                  />
                  <button type="submit">Create room →</button>
                </form>
              </article>

              <article className="panel">
                <div className="panel-icon join-icon">↗</div>
                <h2>Join a room</h2>
                <p>Enter a room code shared by your teammate.</p>

                <form onSubmit={joinRoom}>
                  <label htmlFor="roomCode">Room code</label>
                  <input
                    id="roomCode"
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value)}
                    placeholder="e.g. BF1D3C"
                    maxLength={6}
                  />
                  <button
                    className="secondary-button"
                    type="submit"
                    disabled={isJoining}
                  >
                    {isJoining ? "Joining..." : "Join room →"}
                  </button>
                </form>
              </article>
            </section>

            {message && (
              <p className="message" role="status">
                {message}
              </p>
            )}

            <section className="rooms">
              <div className="section-heading">
                <h2>Your rooms</h2>
                <span>{rooms.length} saved rooms</span>
              </div>

              {rooms.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">{"{}"}</div>
                  <h3>No rooms yet</h3>
                  <p>Create your first room to get started.</p>
                </div>
              ) : (
                <div className="room-list">
                  {rooms.map((room) => (
                    <article className="room-item" key={room.id}>
                      <div>
                        <h3>{room.name}</h3>
                        <p>
                          Room code: <strong>{room.id}</strong>
                        </p>
                      </div>

                      <div className="room-actions">
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => copyRoomCode(room.id)}
                        >
                          Copy code
                        </button>

                        <button
                          className="small-button"
                          type="button"
                          onClick={() => openRoom(room)}
                        >
                          Open room
                        </button>

                        <button
                          className="small-button delete-button"
                          type="button"
                          onClick={() => deleteRoom(room)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="workspace">
            <div className="section-heading">
              <div>
                <p className="eyebrow">COLLABORATIVE WORKSPACE</p>
                <h2>{activeRoom.name}</h2>
                <p>
                  Room code: <strong>{activeRoom.id}</strong>
                </p>
              </div>

              <div className="room-actions">
                <button
                  className="small-button"
                  type="button"
                  onClick={() => copyRoomCode(activeRoom.id)}
                >
                  Copy code
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setActiveRoom(null);
                    setMessage("");
                  }}
                >
                  Back to rooms
                </button>
              </div>
            </div>

            <div className="editor-toolbar">
              <span>
                {language === "cpp"
                  ? "main.cpp"
                  : language === "javascript"
                  ? "main.js"
                  : language === "python"
                  ? "main.py"
                  : "Main.java"}
              </span>

              <span>
                {language === "cpp"
                  ? "C++"
                  : language === "javascript"
                  ? "JavaScript"
                  : language === "python"
                  ? "Python"
                  : "Java"}
              </span>
            </div>

            <div className="editor-toolbar">
              <label htmlFor="language-select">Language: </label>
              <select
                id="language-select"
                value={language}
                onChange={(event) =>
                  handleLanguageChange(event.target.value)
                }
              >
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
              </select>
            </div>

            <Editor
              height="450px"
              language={language}
              theme="vs-dark"
              value={code}
              onChange={handleCodeChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
            />

            <p className="editor-note">
              Changes are sent to other users connected to this room.
            </p>

            <div className="run-controls">
              <label htmlFor="custom-input">Custom Input (stdin)</label>
              <textarea
                id="custom-input"
                value={customInput}
                onChange={(event) => setCustomInput(event.target.value)}
                placeholder="Enter input for your program..."
                rows={4}
              />

              <button
                type="button"
                onClick={handleRunCode}
                disabled={isRunning}
              >
                {isRunning ? "Running..." : "▶ Run Code"}
              </button>
            </div>

            <section className="output-panel">
              <div className="output-heading">
                <h3>Output</h3>
                {runStatus && <span>{runStatus}</span>}
              </div>

              {output && <pre className="output-text">{output}</pre>}

              {runError && <pre className="error-text">{runError}</pre>}

              {!output && !runError && !runStatus && (
                <p>Your program output will appear here.</p>
              )}

              {runStatus && !output && !runError && (
                <p>No output produced.</p>
              )}
            </section>

            {message && (
              <p className="message" role="status">
                {message}
              </p>
            )}
          </section>
        )}

        <footer>
          CodePair · Built for collaborative problem solving
        </footer>
      </main>
    </div>
  );
}

export default App;
