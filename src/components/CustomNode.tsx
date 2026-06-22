import { Handle, Position, NodeProps } from 'reactflow';

export default function CustomNode({ data }: NodeProps) {
  let bgColor = 'bg-white';
  let borderColor = 'border-slate-300';
  let textColor = 'text-slate-800';

  const category = (data.category as string)?.toLowerCase() || '';

  if (category === 'time') {
    bgColor = 'bg-blue-100';
    borderColor = 'border-blue-500';
    textColor = 'text-blue-900';
  } else if (category === 'grammar' || category === 'form') {
    bgColor = 'bg-green-100';
    borderColor = 'border-green-500';
    textColor = 'text-green-900';
  } else if (category === 'root') {
    bgColor = 'bg-slate-800';
    borderColor = 'border-slate-900';
    textColor = 'text-white';
  }

  const hasExtraContent = !!(data.formula || data.example);

  return (
    <div className={`px-4 py-3 shadow-lg rounded-xl border-2 ${bgColor} ${borderColor} ${textColor} min-w-[200px] text-center transition-transform hover:scale-105`}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-400 border-2 border-white" />
      <div className="font-extrabold text-sm tracking-wide">{data.label}</div>
      {data.category && (
        <div className="text-[10px] uppercase font-bold opacity-75 mt-1 tracking-wider">
          {data.category}
        </div>
      )}
      
      {hasExtraContent && (
        <>
          <hr className={`my-2 ${category === 'root' ? 'border-white/20' : 'border-black/10'}`} />
          {data.formula && (
            <div className={`text-xs font-mono p-1 rounded mt-1 whitespace-pre-wrap ${category === 'root' ? 'bg-white/10' : 'bg-black/5'}`}>
              {data.formula}
            </div>
          )}
          {data.example && (
            <div className={`text-[10px] italic mt-1 line-clamp-2 ${category === 'root' ? 'text-slate-300' : 'text-slate-600'}`}>
              {data.example}
            </div>
          )}
        </>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-400 border-2 border-white" />
    </div>
  );
}
