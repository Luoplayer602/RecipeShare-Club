/** Small local illustrations keep the demo self-contained. */
export function FoodArt({ kind }: { kind: number }) {
  kind = ((kind - 1) % 3) + 1
  return <svg viewBox="0 0 320 250" fill="none" aria-hidden="true">
    <ellipse cx="160" cy="211" rx="109" ry="12" fill="#26333B" opacity=".07" />
    <ellipse cx="160" cy="142" rx="118" ry="85" fill="#FFFDF9" />
    <ellipse cx="160" cy="142" rx="102" ry="71" stroke="#E4DCCF" strokeWidth="2" />
    {kind === 1 ? <g transform="rotate(-24 160 140)">
      <rect x="62" y="100" width="196" height="85" rx="42" fill="#BA733E" />
      <path d="M79 148Q160 120 242 147" stroke="#4D6B45" strokeWidth="16" strokeLinecap="round" />
      <path d="M87 153Q160 137 233 155" stroke="#EDD8A6" strokeWidth="13" strokeLinecap="round" />
      <path d="M92 151L117 139M139 146L166 134M187 146L211 135" stroke="#D97854" strokeWidth="7" strokeLinecap="round" />
      <path d="M63 132C64 82 252 81 258 132C220 145 100 146 63 132Z" fill="#E7B56F" />
      <path d="M111 105L99 126M155 99L144 124M200 104L188 125" stroke="#FFF0CE" strokeWidth="7" strokeLinecap="round" />
      <path d="M214 167L231 162M94 168L111 172" stroke="#D0A36B" strokeWidth="3" strokeLinecap="round" />
    </g> : kind === 2 ? <g>
      <ellipse cx="160" cy="141" rx="81" ry="55" fill="#DCA26F" />
      <path d="M102 128L173 168L193 106L120 155L212 145M117 113L198 163L156 99L139 182" stroke="#F7D3A5" strokeWidth="13" strokeLinejoin="round" />
      <path d="M109 142L188 117M138 172L207 132M129 106L183 161" stroke="#DE9161" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="124" cy="122" rx="14" ry="17" fill="#FFF9EA" transform="rotate(-24 124 122)" /><ellipse cx="124" cy="122" rx="7" ry="9" fill="#E8BE66" />
      <ellipse cx="186" cy="156" rx="14" ry="17" fill="#FFF9EA" transform="rotate(24 186 156)" /><ellipse cx="186" cy="156" rx="7" ry="9" fill="#E8BE66" />
      <path d="M153 117Q144 95 167 96Q177 113 153 117M202 135Q211 111 224 128Q222 145 202 135M129 163Q106 158 112 180Q130 185 129 163" fill="#73916B" />
      <circle cx="150" cy="151" r="4" fill="#AD7949" /><circle cx="181" cy="120" r="4" fill="#AD7949" />
    </g> : <g>
      <ellipse cx="160" cy="145" rx="81" ry="57" fill="#F2E5CE" />
      <path d="M116 111C126 98 145 106 158 100C179 85 200 103 199 119C225 129 219 155 201 161C196 185 165 187 148 175C124 183 103 169 111 151C91 137 98 120 116 111Z" fill="#FFFCF0" stroke="#E5D5B2" strokeWidth="2" />
      <circle cx="159" cy="138" r="25" fill="#E8B652" /><path d="M151 124Q160 119 168 127" stroke="#F8D781" strokeWidth="5" strokeLinecap="round" />
      <path d="M104 168L117 175M191 111L199 103M184 172L194 166" stroke="#6D8A61" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="222" cy="169" rx="12" ry="23" fill="#91A987" transform="rotate(30 222 169)" /><ellipse cx="222" cy="169" rx="7" ry="17" fill="#CBD7AE" transform="rotate(30 222 169)" />
    </g>}
    <path d="M254 70L258 61M267 81L277 78" stroke="#C87952" strokeWidth="3" strokeLinecap="round" opacity=".55" />
  </svg>
}
