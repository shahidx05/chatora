const MessageStatusIcon = ({ status }) => {
    switch (status) {
        case "sent":
            return <span className="text-gray-400 text-xs">✓</span>;

        case "delivered":
            return <span className="text-gray-400 text-xs">✓✓</span>;

        case "seen":
            return <span className="text-blue-500 text-xs">✓✓</span>;

        default:
            return null;
    }
};

export default MessageStatusIcon;