# backend/main.py

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from model import process_image_async

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/inference")
async def inference(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg","image/png"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    try:
        contents = await file.read()
        score = await process_image_async(contents)
        if score is None:
            raise HTTPException(status_code=500, detail="Error processing image or no face found.")
        percentage = score * 100
        if percentage > 80:
            witty = f"Your beauty score is {percentage:.1f}%. You must be the fairest of them all!"
        elif percentage > 50:
            witty = f"Your beauty score is {percentage:.1f}%. Not bad, but even magic has its limits!"
        else:
            witty = f"Your beauty score is {percentage:.1f}%. Even the magic mirror has its off days."
        return {"response": witty}
    except Exception as e:
        print("Inference error:", e)
        raise HTTPException(status_code=500, detail="Error processing the image")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
