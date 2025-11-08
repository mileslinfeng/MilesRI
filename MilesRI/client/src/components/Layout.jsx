//D:\usstocks\client\src\components\Layout.jsx
import React from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout({ view, setView, children }) {
  return (
    <div className="sa-layout">
      <Header />
      <div className="sa-body">
        <Sidebar view={view} setView={setView} />
        <main className="sa-main">
          <div className="max-w-7xl mx-auto p-5">{children}</div>
        </main>
      </div>
    </div>

  );
}

