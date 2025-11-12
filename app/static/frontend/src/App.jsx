import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Re-initialize xlwings after React renders to register xw-click buttons
    if (window.xlwings && window.xlwings.init) {
      window.xlwings.init();
    }
  }, []);

  return (
    <div className="container-fluid pt-3 ps-3">
      <h2>React Task Pane</h2>
      <div className="mb-3 d-flex flex-column gap-2">
        <button
          xw-click="hello_world"
          className="btn btn-primary btn-sm"
          type="button"
        >
          Write 'Hello/Bye xlwings!' to A1
        </button>

        <button
          onClick={() => setCount((count) => count + 1)}
          className="btn btn-secondary btn-sm"
        >
          React counter: {count}
        </button>
      </div>
    </div>
  );
}

export default App;
