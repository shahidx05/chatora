import ConversationCard from "./ConversationCard";

const ConversationList = ({
    conversations,
    selectedConversation,
    onSelectConversation,
}) => {
    return (
        <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                    No conversations found
                </div>
            ) : (
                conversations.map((conversation) => (
                    <ConversationCard
                        key={conversation.conversationId}
                        conversation={conversation}
                        selected={
                            selectedConversation?.conversationId === conversation.conversationId
                        }
                        onClick={() => onSelectConversation(conversation)}
                    />
                ))
            )}
        </div>
    );
};

export default ConversationList;