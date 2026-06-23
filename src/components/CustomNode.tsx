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

  const hasLegacyContent = !!(data.formula || data.example);
  const hasNewContent = !!(data.verbal_formula || data.nominal_formula || data.pos_form || data.neg_form || data.int_form);
  const hasExtraContent = hasLegacyContent || hasNewContent;

  return (
    <div className={`px-4 py-3 md:px-4 md:py-3 shadow-lg rounded-xl border-2 ${bgColor} ${borderColor} ${textColor} min-w-[220px] md:min-w-[300px] text-left`}>
      <Handle type="target" position={Position.Top} className="!w-3.5 !h-3.5 !bg-slate-400 border-2 border-white" />
      <div className="font-extrabold text-sm text-center tracking-wide">{data.label}</div>
      {data.category && (
        <div className="text-[10px] uppercase text-center font-bold opacity-75 mt-1 tracking-wider">
          {data.category}
        </div>
      )}
      
      {hasExtraContent && (
        <>
          <hr className={`my-2 ${category === 'root' ? 'border-white/20' : 'border-black/10'}`} />
          
          {hasNewContent ? (
            <div className="flex flex-col gap-2 mt-2">
              {(data.verbal_formula || data.nominal_formula) && (
                <div className="grid grid-cols-2 gap-2 text-[9px] leading-tight">
                  {data.verbal_formula && (
                    <div className={`p-1.5 rounded ${category === 'root' ? 'bg-white/10' : 'bg-black/5'}`}>
                      <div className={`font-bold mb-0.5 ${category === 'root' ? 'text-indigo-300' : 'text-indigo-600'}`}>Verbal:</div>
                      <div className="font-mono opacity-90 whitespace-pre-wrap">{data.verbal_formula}</div>
                    </div>
                  )}
                  {data.nominal_formula && (
                    <div className={`p-1.5 rounded ${category === 'root' ? 'bg-white/10' : 'bg-black/5'}`}>
                      <div className={`font-bold mb-0.5 ${category === 'root' ? 'text-teal-300' : 'text-teal-600'}`}>Nominal:</div>
                      <div className="font-mono opacity-90 whitespace-pre-wrap">{data.nominal_formula}</div>
                    </div>
                  )}
                </div>
              )}

              {(data.pos_form || data.neg_form || data.int_form) && (
                <div className={`text-[9px] font-mono p-1.5 rounded space-y-1.5 ${category === 'root' ? 'bg-white/10' : 'bg-black/5'}`}>
                  {data.pos_form && <div><span className={`font-bold ${category === 'root' ? 'text-green-400' : 'text-green-600'}`}>(+)</span> <span className="whitespace-pre-wrap leading-relaxed">{data.pos_form}</span></div>}
                  {data.neg_form && <div><span className={`font-bold ${category === 'root' ? 'text-red-400' : 'text-red-500'}`}>(-)</span> <span className="whitespace-pre-wrap leading-relaxed">{data.neg_form}</span></div>}
                  {data.int_form && <div><span className={`font-bold ${category === 'root' ? 'text-blue-400' : 'text-blue-600'}`}>(?)</span> <span className="whitespace-pre-wrap leading-relaxed">{data.int_form}</span></div>}
                </div>
              )}
            </div>
          ) : (
            <>
              {data.formula && (
                <div className={`text-[11px] font-mono p-1.5 rounded mt-1 whitespace-pre-wrap ${category === 'root' ? 'bg-white/10' : 'bg-black/5'}`}>
                  {data.formula}
                </div>
              )}
              {data.example && (
                <div className={`text-[11px] italic mt-1 line-clamp-2 ${category === 'root' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {data.example}
                </div>
              )}
            </>
          )}
        </>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-3.5 !h-3.5 !bg-slate-400 border-2 border-white" />
    </div>
  );
}
