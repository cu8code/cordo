import React, { useState } from "react";

const OptionMenu: React.FC = () => {
  const [activeTab, setActiveTab] = useState("view");

  return (
    <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white h-full">
      <div className="flex flex-col">
        <h2 className="font-medium">Settings</h2>
      </div>
    </div>
  );
};

export default OptionMenu;
