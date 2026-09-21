interface Props {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="bg-white border rounded-lg p-8 shadow-sm">
      <h1 className="text-xl font-bold mb-2">{title}</h1>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}
