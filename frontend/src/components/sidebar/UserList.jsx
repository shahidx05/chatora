import UserCard from "./UserCard";

const UserList = ({
    users,
    selectedUser,
    onSelectUser,
}) => {
    return (
        <div className="flex-1 overflow-y-auto">
            {users.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                    No users found
                </div>
            ) : (
                users.map((user) => (
                    <UserCard
                        key={user._id}
                        user={user}
                        selected={selectedUser?._id === user._id}
                        onClick={() => onSelectUser(user)}
                    />
                ))
            )}
        </div>
    );
};

export default UserList;