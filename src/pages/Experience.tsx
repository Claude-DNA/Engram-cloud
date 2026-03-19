import { useParams } from "react-router-dom";

export default function Experience() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-text-primary">
        Experience: <span className="text-accent-gold">{id}</span>
      </h2>
      <p className="text-text-secondary mt-2">Experience view placeholder.</p>
    </div>
  );
}
