from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import json
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
OPENROUTER_API_KEY = ""
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

class TextInput(BaseModel):
    input_text: str

@app.get("/")
async def health():
    return {"message": "Server is running"}

@app.post("/generate")
async def generate_response(input_data: TextInput):
    print(f"Received input: {input_data.input_text}")
    if not input_data.input_text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")
    payload = {
        "model": "meta-llama/llama-3.2-90b-vision-instruct",
        "messages": [
                    {
            "role": "system",
            "content": "You are a helpful AI assistant. Provide only one clear and concise answer to the user's question. Do not generate multiple responses."
        },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": input_data.input_text}
                ]
            }
        ]
    }

    try:
        response = requests.post(
            url=OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            data=json.dumps(payload)
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        result = response.json()

        # 📤 Extract and return generated output string
        output_text = result["choices"][0]["message"]["content"]
        return {"output_text": output_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
