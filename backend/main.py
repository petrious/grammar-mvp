from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import httpx
import json
import os
from dotenv import dotenv_values

config = dotenv_values(".env")

app = FastAPI(title="GrammarMVP — English Grammar Checker with Gemini Flash")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

LANGUAGETOOL_URL = "http://localhost:8010/v2/check"
DICTIONARY_FILE  = os.path.join(os.path.dirname(__file__), "dictionary.json")


def load_dictionary() -> list[str]:
    if os.path.exists(DICTIONARY_FILE):
        with open(DICTIONARY_FILE) as f:
            return json.load(f)
    return []


def save_dictionary(words: list[str]):
    with open(DICTIONARY_FILE, "w") as f:
        json.dump(sorted(set(words)), f)

GEMINI_API_KEY  = config.get("GEMINI_API_KEY", "")
GEMINI_MODEL    = "gemini-2.0-flash-lite"
GEMINI_BASE_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


# ── Models ──────────────────────────────────────────────────
class CheckRequest(BaseModel):
    text: str

class RewriteRequest(BaseModel):
    text: str
    tone: str = "professional"   # professional | academic | informal

class DictionaryRequest(BaseModel):
    word: str


# ── Helper: Gemini API call ─────────────────────────────────
async def call_gemini(prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Edit the .env file"
        )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1024,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(3):
            resp = await client.post(GEMINI_BASE_URL, params={"key": GEMINI_API_KEY}, json=payload)
            if resp.status_code == 429 and attempt < 2:
                await asyncio.sleep(2 ** attempt)
                continue
            break

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API error: {resp.status_code} — {resp.text[:200]}"
        )

    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Unexpected response from Gemini")


# ── Endpoints ────────────────────────────────────────────────
@app.get("/")
def root():
    configured = bool(GEMINI_API_KEY)
    return {
        "status": "ok",
        "gemini_configured": configured,
        "model": GEMINI_MODEL,
        "message": "GrammarMVP is running!" if configured else "⚠️ Configure GEMINI_API_KEY in the .env file",
    }


@app.post("/check")
async def check_grammar(req: CheckRequest):
    """Check grammar errors via local LanguageTool (no AI, no cost)"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                LANGUAGETOOL_URL,
                data={"text": req.text, "language": "en-US"},
            )
        data = resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="LanguageTool offline. Start with: docker run -d -p 8010:8010 erikvl87/languagetool"
        )

    dictionary = load_dictionary()
    matches = []
    for m in data.get("matches", []):
        # Skip words that are in the user's dictionary
        word = req.text[m["offset"]:m["offset"] + m["length"]]
        if word.lower() in [w.lower() for w in dictionary]:
            continue
        matches.append({
            "offset":       m["offset"],
            "length":       m["length"],
            "message":      m["message"],
            "short_message": m.get("shortMessage", ""),
            "rule":         m["rule"]["id"],
            "replacements": [r["value"] for r in m["replacements"][:3]],
            "context":      m["context"]["text"],
            "word":         word,
        })

    return {
        "text":         req.text,
        "errors_found": len(matches),
        "matches":      matches,
    }


@app.post("/rewrite")
async def rewrite_text(req: RewriteRequest):
    """Rewrite text using Gemini Flash"""
    tone_map = {
        "professional": "professional and clear, suitable for corporate emails",
        "academic":     "academic and formal, suitable for papers and reports",
        "informal":     "natural and friendly, while maintaining clarity",
    }
    tone_desc = tone_map.get(req.tone, tone_map["professional"])

    prompt = f"""You are an expert English writing assistant.

Rewrite the text below with a {tone_desc} tone.
- Fix all grammar and spelling errors
- Improve clarity and flow
- Keep the original meaning and length similar — do NOT expand a short sentence into a full email or letter
- Do NOT add greetings, sign-offs, subject lines, or placeholders like [Name]
- If the text is already correct, return it as-is with minimal changes
- Reply ONLY with the rewritten text, no comments or explanations

Original text:
{req.text}"""

    rewritten = await call_gemini(prompt)
    return {
        "original":  req.text,
        "rewritten": rewritten,
        "tone":      req.tone,
    }


@app.post("/explain")
async def explain_error(req: CheckRequest):
    """Explain errors in a clear, educational way using Gemini Flash"""
    prompt = f"""You are a patient and helpful English writing tutor.

Analyze the text below and explain in a clear, simple way:
1. What errors exist (grammar, spelling, agreement, punctuation)
2. Why each point is incorrect
3. How to write it correctly

Be concise, use practical examples, and be encouraging. Maximum 250 words.

Text: "{req.text}"
"""

    explanation = await call_gemini(prompt)
    return {
        "text":        req.text,
        "explanation": explanation,
    }


@app.get("/dictionary")
def get_dictionary():
    """Get all words in the user dictionary"""
    return {"words": load_dictionary()}


@app.post("/dictionary")
def add_to_dictionary(req: DictionaryRequest):
    """Add a word to the user dictionary"""
    words = load_dictionary()
    word = req.word.strip()
    if word and word.lower() not in [w.lower() for w in words]:
        words.append(word)
        save_dictionary(words)
    return {"words": load_dictionary(), "added": word}


@app.delete("/dictionary")
def remove_from_dictionary(req: DictionaryRequest):
    """Remove a word from the user dictionary"""
    words = load_dictionary()
    word = req.word.strip()
    words = [w for w in words if w.lower() != word.lower()]
    save_dictionary(words)
    return {"words": words, "removed": word}
