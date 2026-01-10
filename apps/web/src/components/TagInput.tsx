import { useState, type KeyboardEvent } from 'react'

type TagInputProps = {
  value: string[]
  onChange: (tags: string[]) => void
  maxTags?: number
  placeholder?: string
}

const normalizeTag = (value: string) => value.trim()

const TagInput = ({ value, onChange, maxTags = 8, placeholder }: TagInputProps) => {
  const [draft, setDraft] = useState('')

  const addTag = (raw: string) => {
    const trimmed = normalizeTag(raw)
    if (!trimmed) {
      return
    }
    const exists = value.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      setDraft('')
      return
    }
    if (value.length >= maxTags) {
      setDraft('')
      return
    }
    onChange([...value, trimmed])
    setDraft('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(draft)
    }
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const handleBlur = () => {
    addTag(draft)
  }

  return (
    <div className="tag-input">
      <div className="tag-input__list">
        {value.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} aria-label={`移除 ${tag}`}>
              x
            </button>
          </span>
        ))}
        <input
          className="tag-input__field"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder ?? 'Add tags'}
        />
      </div>
      <span className="tag-input__hint">最多 {maxTags} 个，回车添加</span>
    </div>
  )
}

export default TagInput
