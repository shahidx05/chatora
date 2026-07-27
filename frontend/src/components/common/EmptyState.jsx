const EmptyState = ({
    title = "Nothing here",
    description = "There is nothing to display.",
    icon = "📭",
}) => {
    return (
        <div className="flex-1 flex items-center justify-center bg-gray-50">

            <div className="text-center">

                <div className="text-6xl mb-4">
                    {icon}
                </div>

                <h2 className="text-2xl font-semibold text-gray-700">
                    {title}
                </h2>

                <p className="mt-2 text-gray-500 max-w-sm">
                    {description}
                </p>

            </div>

        </div>
    );
};

export default EmptyState;