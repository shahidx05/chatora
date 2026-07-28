// import { useState, useEffect, useRef } from 'react'
// import { getUsers } from '../services/user.service'
// import { getMessages } from '../services/message.service'
// import { io } from "socket.io-client";

// const Home = () => {
//   const [users, setUsers] = useState([]);
//   const [messages, setMessages] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [message, setMessage] = useState("")
//   const [isTyping, setIsTyping] = useState(false);

//   const token = localStorage.getItem('token');
//   if (!token) {
//     window.location.href = '/login';
//   }
//   const currentUser = JSON.parse(localStorage.getItem("user"));

//   const socket = useRef(null);
//   const typingTimeout = useRef(null);
//   const messagesEndRef = useRef(null);

//   useEffect(() => {
//     socket.current = io("http://localhost:3000", {
//       auth: { token }
//     });

//     return () => {
//       socket.current.disconnect();
//     };
//   }, [token]);

//   useEffect(() => {
//     socket.current.on("connect", () => {
//       console.log("connected", socket.current.id);
//     });

//     // socket.on("me", (user) => {
//     //   console.log(user.username);
//     // });

//     // socket.on("welcome", (message) => {
//     //   console.log(message);
//     // });

//     // socket.on('connect_error', (err) => {
//     //   console.log('Connection failed:', err.message);
//     // });

//     // socket.on("mess", (message) => {
//     //   console.log(message);
//     // });

//     // socket.current.on("receive_message", (data) => {
//     //   console.log(data.message, "from", data.user);
//     //   if (selectedUser && data.user === selectedUser._id) {
//     //     setMessages((prevMessages) => [
//     //       ...prevMessages,
//     //       { content: data.message, mine: false, _id: Date.now() }
//     //     ]);
//     //   }
//     // })

//     socket.current.on("online_users", (data) => {
//       console.log("Online users:", data);
//       setUsers(prev =>
//         prev.map(user =>
//           data.includes(user._id)
//             ? { ...user, online: true }
//             : { ...user, online: false }
//         )
//       );
//     })
//   }, [token]);

//   useEffect(() => {
//     const receiveHandler = (data) => {
//       // if (selectedUser && String(data.sender) === String(selectedUser._id)) {
//       //   setMessages(prev => [...prev, data]);
//       // }
//       if (!selectedUser) return;

//       const isIncoming =
//         String(data.sender) === String(selectedUser._id);

//       const isOutgoing =
//         String(data.receiver) === String(selectedUser._id);

//       if (isIncoming || isOutgoing) {
//         setMessages(prev => [...prev, data]);
//       }

//       if (isIncoming) {
//         setMessages(prev => [...prev, data]);

//         socket.current.emit("mark_seen", {
//           sender: data.sender
//         });
//       }
//     };

//     const typingHandler = (data) => {
//       if (selectedUser && String(data.sender) === String(selectedUser._id)) {
//         setIsTyping(data.typing);
//       }
//     };

//     const onlineHandler = (data) => {
//       setUsers(prev =>
//         prev.map(user =>
//           user._id === data.userId
//             ? {
//               ...user,
//               online: true,
//               lastSeen: null
//             }
//             : user
//         )
//       );

//       if (selectedUser?._id === data.userId) {
//         setSelectedUser(prev => ({
//           ...prev,
//           online: true,
//           lastSeen: null
//         }));
//       }
//     };

//     const offlineHandler = (data) => {
//       setUsers(prev =>
//         prev.map(user =>
//           user._id === data.userId
//             ? {
//               ...user,
//               online: false,
//               lastSeen: data.lastSeen
//             }
//             : user
//         )
//       );

//       if (selectedUser?._id === data.userId) {
//         setSelectedUser(prev => ({
//           ...prev,
//           online: false,
//           lastSeen: data.lastSeen
//         }));
//       }
//     };

//     const statusHandler = (data) => {
//       console.log("hello")
//       console.log(`Message ${data.messageId} status updated to ${data.status}`);
//       setMessages(prev =>
//         prev.map(msg =>
//           String(msg._id) === String(data.messageId)
//             ? { ...msg, status: data.status }
//             : msg
//         )
//       );
//     };

//     socket.current.on("receive_message", receiveHandler);
//     socket.current.on("typing", typingHandler);
//     socket.current.on("user_online", onlineHandler);
//     socket.current.on("user_offline", offlineHandler);
//     socket.current.on("message_status_updated", statusHandler)

//     return () => {
//       socket.current.off("receive_message", receiveHandler);
//       socket.current.off("typing", typingHandler);
//       socket.current.off("user_online", onlineHandler);
//       socket.current.off("user_offline", offlineHandler);
//       socket.current.off("message_status_updated", statusHandler)
//     };
//   }, [selectedUser]);

//   useEffect(() => {
//     const fetchUsers = async () => {
//       try {
//         const data = await getUsers();
//         setUsers(data.users);
//       } catch (error) {
//         console.error("Error fetching users:", error);
//       }
//     };

//     fetchUsers();
//   }, []);

//   const fetchMessages = async (userId) => {
//     try {
//       const data = await getMessages(userId);
//       setMessages(data.messages);
//     } catch (error) {
//       console.error("Error fetching messages:", error);
//     }
//   };

//   useEffect(() => {
//     setIsTyping(false);
//     if (!selectedUser) return;

//     socket.current.emit("mark_seen", {
//       sender: selectedUser._id
//     });

//     fetchMessages(selectedUser._id);
//   }, [selectedUser]);

//   const handleChange = (e) => {
//     const value = e.target.value;
//     setMessage(value);

//     socket.current.emit("typing", {
//       receiver: selectedUser._id,
//       typing: true,
//     });

//     clearTimeout(typingTimeout.current);

//     typingTimeout.current = setTimeout(() => {
//       socket.current.emit("typing", {
//         receiver: selectedUser._id,
//         typing: false,
//       });
//     }, 1000);
//   };

//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({
//       behavior: "smooth"
//     });
//   }, [messages]);

//   return (
//     <div className="h-screen flex bg-gray-100">

//       {/* Sidebar */}
//       <div className="w-80 bg-white border-r flex flex-col">

//         <div className="p-5 border-b">
//           <h1 className="text-2xl font-bold">Chat App</h1>
//         </div>

//         <div className="flex-1 overflow-y-auto">
//           {users.map((user) => (
//             <div
//               key={user._id}
//               onClick={() => setSelectedUser(user)}
//               className={`flex items-center gap-3 p-4 border-b cursor-pointer transition-colors ${selectedUser?._id === user._id
//                 ? "bg-blue-50"
//                 : "hover:bg-gray-100"
//                 }`}
//             >
//               <div className="relative">
//                 <div className="h-12 w-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
//                   {user.name[0]}
//                 </div>

//                 {user.online && (
//                   <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
//                 )}
//               </div>

//               <div className="flex-1">
//                 <h2 className="font-semibold">{user.name}</h2>
//               </div>
//             </div>
//           ))}
//         </div>

//       </div>

//       {/* Chat Section */}
//       <div className="flex-1 flex flex-col">

//         {!selectedUser ? (
//           <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
//             <div className="text-center max-w-md px-8">
//               <h1 className="mt-6 text-3xl font-bold text-gray-800">
//                 Welcome to Chat App
//               </h1>

//               <p className="mt-3 text-gray-600 leading-relaxed">
//                 Select a user from the sidebar to start chatting.
//               </p>

//             </div>
//           </div>
//         ) : (
//           <>
//             {/* Header */}
//             <div className="h-20 bg-white border-b flex items-center px-6">
//               <div className="h-12 w-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
//                 {selectedUser ? selectedUser.name[0] : "U"}
//               </div>

//               <div className="ml-4">
//                 <h2 className="font-semibold text-lg">
//                   {selectedUser ? selectedUser.name : "Select a user"}
//                 </h2>
//                 <p
//                   className={`text-sm ${selectedUser?.online
//                     ? "text-green-600"
//                     : "text-gray-500"
//                     }`}
//                 >
//                   {selectedUser?.online
//                     ? "Online"
//                     : selectedUser?.lastSeen
//                       ? `Last seen ${new Date(selectedUser.lastSeen).toLocaleString()}`
//                       : "Offline"}
//                 </p>
//               </div>
//             </div>

//             {/* Messages */}
//             <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">

//               {messages.map((msg) => {
//                 // console.log("Rendering message:", msg);
//                 const mine = String(msg.sender) === String(currentUser.id);
//                 const messageTime = msg.createdAt
//                   ? new Date(msg.createdAt).toLocaleTimeString([], {
//                     hour: "2-digit",
//                     minute: "2-digit"
//                   })
//                   : "";
//                 // const statusText = mine ? msg.status || "Sent" : null;

//                 return (
//                   <div
//                     key={msg._id}
//                     className={`flex ${mine ? "justify-end" : "justify-start"}`}
//                   >
//                     <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
//                       <div
//                         className={`px-4 py-2 rounded-xl max-w-sm ${mine
//                           ? "bg-blue-600 text-white"
//                           : "bg-white border"}`}
//                       >
//                         {msg.content}
//                       </div>

//                       <span className="mt-1 text-[10px] text-gray-400">
//                         {messageTime}
//                       </span>

//                       {mine && (
//                         <span
//                           className={`mt-1 text-xs ${msg.status === "seen"
//                             ? "text-green-500"
//                             : "text-gray-400"}`}
//                         >
//                           {msg.status === "seen"
//                             ? "✓✓ Seen"
//                             : msg.status === "delivered"
//                               ? "✓✓ Delivered"
//                               : "✓ Sent"}
//                         </span>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })}
//               <div ref={messagesEndRef}></div>
//               {isTyping && (
//                 <div className="flex justify-start">
//                   <div className="flex items-center gap-2 bg-white border rounded-xl px-4 py-2">
//                     <span className="text-sm text-gray-500">Typing</span>

//                     <div className="flex gap-1">
//                       <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
//                       <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
//                       <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
//                     </div>
//                   </div>
//                 </div>
//               )}

//             </div>

//             {/* Input */}
//             <div className="bg-white border-t p-4 flex gap-3">

//               <input
//                 type="text"
//                 value={message}
//                 onChange={handleChange}
//                 placeholder="Type a message..."
//                 className="flex-1 border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
//               />

//               <button
//                 className="bg-blue-600 text-white px-6 rounded-lg hover:bg-blue-700"
//                 onClick={() => {
//                   if (message.trim() !== "") {
//                     socket.current?.emit("send_message", { receiver: selectedUser._id, message });
//                     setMessage("");
//                     // Optionally, you can also add the sent message to the messages state
//                     // setMessages((prevMessages) => [
//                     //   ...prevMessages,
//                     //   { content: message, sender: currentUser.id, receiver: selectedUser._id, _id:  }
//                     // ]);
//                     socket.current.emit("typing", {
//                       receiver: selectedUser._id,
//                       typing: false,
//                     });
//                   }
//                 }}
//               >
//                 Send
//               </button>

//             </div>
//           </>
//         )}

//       </div>
//     </div>
//   );
// };

// export default Home;


import Sidebar from '../components/sidebar/Sidebar'
import ChatWindow from '../components/chat/ChatWindow'

const Home = () => {
  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <ChatWindow />
    </div>
  )
}

export default Home