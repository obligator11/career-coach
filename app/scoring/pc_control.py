import os
import subprocess
import webbrowser


KNOWN_APPS = {
    "notepad": "notepad",
    "calculator": "calc",
    "explorer": "explorer",
    "file explorer": "explorer",
}

# Apps that need os.startfile (registered Windows apps, not simple PATH commands)
STARTFILE_APPS = {
    "chrome": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "google chrome": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
}



def open_app(name: str) -> str:
    """Open a known Windows application by name. Returns a status message."""
    key = name.strip().lower()


    if key in STARTFILE_APPS:
        try:
            os.startfile(STARTFILE_APPS[key])
            return f"Opened {name}."
        except OSError:
            return f"Couldn't find {name} installed on this system - it may need a different launch method."


    if key in KNOWN_APPS:
        try:
            subprocess.Popen(KNOWN_APPS[key])
            return f"Opened {name}."
        except FileNotFoundError:
            return f"Couldn't find {name} installed on this system."

    

    return f"I don't know how to open '{name}' yet."


def close_app(name: str) -> str:
    """Close a known Windows application by name using taskkill. Returns a status message."""
    key = name.strip().lower()
    process_map = {
        "chrome": "chrome.exe",
        "google chrome": "chrome.exe",
        "notepad": "notepad.exe",
        "calculator": "CalculatorApp.exe",
        "vscode": "Code.exe",
        "vs code": "Code.exe",
    }

    if key not in process_map:
        return f"I don't know how to close '{name}' yet."

    try:
        subprocess.run(["taskkill", "/IM", process_map[key], "/F"], capture_output=True, timeout=5)
        return f"Closed {name}."
    except Exception as e:
        return f"Couldn't close {name}: {e}"