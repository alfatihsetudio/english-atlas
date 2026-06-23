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
    <div className={`p-3 shadow-lg rounded-xl border-2 ${bgColor} ${borderColor} ${textColor} w-[300px] text-left`}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-400 border-2 border-white" />
      <div className="font-extrabold text-xs text-center tracking-wide">{data.label}</div>
      {data.category && (
        <div className="text-[9px] uppercase text-center font-bold opacity-75 mt-0.5 tracking-wider">
          {data.category}
        </div>
      )}
      
      {hasExtraContent && (
        <>
          <hr className={`my-1.5 ${category === 'root' ? 'border-white/20' : 'border-black/10'}`} />
          
          {hasNewContent ? (
            <div className="flex flex-col gap-1.5 mt-1.5">
              {(data.verbal_formula || data.nominal_formula) && (
                <div className="flex flex-col gap-1 text-[10px] leading-tight">
                  {data.verbal_formula && (
                    <div className={`p-1.5 py-1 rounded ${category === 'root' ? 'bg-white/10' : 'bg-black/5'} flex gap-1.5`}>
                      <span className={`font-bold shrink-0 ${category === 'root' ? 'text-indigo-300' : 'text-indigo-600'}`}>Verbal:</span>
                      <span className="font-mono opacity-90 whitespace-pre-wrap">{data.verbal_formula}</span>
                    </div>
                  )}
                  {data.nominal_formula && (
                    <div className={`p-1.5 py-1 rounded ${category === 'root' ? 'bg-white/10' : 'bg-black/5'} flex gap-1.5`}>
                      <span className={`font-bold shrink-0 ${category === 'root' ? 'text-teal-300' : 'text-teal-600'}`}>Nominal:</span>
                      <span className="font-mono opacity-90 whitespace-pre-wrap">{data.nominal_formula}</span>
                    </div>
                  )}
                </div>
              )}

              {(data.pos_form || data.neg_form || data.int_form) && (
                <div className={`text-[9px] font-mono p-1.5 py-1 rounded space-y-1 ${category === 'root' ? 'bg-white/10' : 'bg-black/5'}`}>
                  {data.pos_form && <div><span className={`font-bold ${category === 'root' ? 'text-green-400' : 'text-green-600'}`}>(+)</span> <span className="whitespace-pre-wrap leading-relaxed">{data.pos_form}</span></div>}
                  {data.neg_form && <div><span className={`font-bold ${category === 'root' ? 'text-red-400' : 'text-red-500'}`}>(-)</span> <span className="whitespace-pre-wrap leading-relaxed">{data.neg_form}</span></div>}
                  {data.int_form && <div><span className={`font-bold ${category === 'root' ? 'text-blue-400' : 'text-blue-600'}`}>(?)</span> <span className="whitespace-pre-wrap leading-relaxed">{data.int_form}</span></div>}
                </div>
              )}
            </div>
          ) : (
            <>
              {data.formula && (
                <div className={`text-[10px] font-mono p-1.5 py-1 rounded mt-1 whitespace-pre-wrap ${category === 'root' ? 'bg-white/10' : 'bg-black/5'}`}>
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
        </>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-400 border-2 border-white" />
    </div>
  );
}
