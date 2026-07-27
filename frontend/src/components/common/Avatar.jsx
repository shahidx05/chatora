const Avatar = ({
    name = "User",
    size = "md",
    online = false,
}) => {

    const sizes = {
        sm: "w-10 h-10 text-sm",
        md: "w-12 h-12 text-lg",
        lg: "w-16 h-16 text-2xl",
    };

    return (
        <div className="relative flex-shrink-0">

            <div
                className={`rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold ${sizes[size]}`}
            >
                {name.charAt(0).toUpperCase()}
            </div>

            {online && (
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white"></span>
            )}

        </div>
    );
};

export default Avatar;