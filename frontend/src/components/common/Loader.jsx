const Loader = ({ text = "Loading..." }) => {
    return (
        <div className="flex-1 flex items-center justify-center">

            <div className="flex flex-col items-center gap-4">

                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>

                <p className="text-gray-500">
                    {text}
                </p>

            </div>

        </div>
    );
};

export default Loader;