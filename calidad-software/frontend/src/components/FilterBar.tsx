type Props = {
  valor: string;
  onChange: (valor: string) => void;
  placeholder: string;
};

export function FilterBar({ valor, onChange, placeholder }: Props) {
  return (
    <div className="input-group">
      <span className="input-group-text">
        <i className="bi bi-search" />
      </span>
      <input
        className="form-control"
        value={valor}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
