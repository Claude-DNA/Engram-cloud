export default function Home() {
  return (
    <div className="flex items-center justify-center h-full min-h-[calc(100vh-2rem)]">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-text-primary mb-4">
          Engram{" "}
          <span className="text-accent-gold">Cloud</span>
        </h1>
        <p className="text-text-secondary text-lg">
          Your memory, organized.
        </p>
      </div>
    </div>
  );
}
