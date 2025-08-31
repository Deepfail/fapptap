using System;
using System.Diagnostics;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

class Program
{
    static int Main(string[] args)
    {
        try
        {
            // Get the directory where this executable is located
            string exeDir = AppContext.BaseDirectory;
            string workerScript = null;
            
            Console.Error.WriteLine($"Debug: exeDir = {exeDir}");
            
            // Try multiple possible locations for the worker script
            string[] possiblePaths = {
                // Development mode: src-tauri/binaries/worker/worker.exe -> ../../worker/main.py
                Path.GetFullPath(Path.Combine(exeDir, "..", "..", "worker", "main.py")),
                // Alternative dev mode: if run from different location
                Path.GetFullPath(Path.Combine(exeDir, "..", "..", "..", "worker", "main.py")),
                // Production mode: bundled with the binary
                Path.Combine(exeDir, "worker", "main.py"),
                Path.Combine(exeDir, "main.py"),
                // Production mode: in app resources
                Path.Combine(exeDir, "..", "worker", "main.py"),
                Path.Combine(exeDir, "..", "Resources", "worker", "main.py"),
                // Fallback: current directory
                Path.Combine(Directory.GetCurrentDirectory(), "worker", "main.py"),
                // Try environment variable if set
                Environment.GetEnvironmentVariable("FAPPTAP_WORKER_SCRIPT")
            };
            
            // Find the first existing script
            foreach (string path in possiblePaths)
            {
                if (!string.IsNullOrEmpty(path) && File.Exists(path))
                {
                    workerScript = path;
                    Console.Error.WriteLine($"Debug: Found worker script at {workerScript}");
                    break;
                }
                else if (!string.IsNullOrEmpty(path))
                {
                    Console.Error.WriteLine($"Debug: Tried {path} - not found");
                }
            }
            
            if (workerScript == null)
            {
                Console.Error.WriteLine("Worker script not found. Tried locations:");
                foreach (string path in possiblePaths)
                {
                    if (!string.IsNullOrEmpty(path))
                    {
                        Console.Error.WriteLine($"  - {path}");
                    }
                }
                Console.Error.WriteLine($"Current directory: {Directory.GetCurrentDirectory()}");
                Console.Error.WriteLine($"Executable directory: {exeDir}");
                return 1;
            }
            
            // Find Python executable
            string pythonExe = FindPython();
            if (pythonExe == null)
            {
                Console.Error.WriteLine("Python executable not found in PATH");
                return 1;
            }
            
            // Determine working directory - should be project root where cache/ and render/ directories are
            string workingDir = DetermineWorkingDirectory(workerScript);
            Console.Error.WriteLine($"Debug: workingDir = {workingDir}");
            
            // Prepare arguments for Python
            var processArgs = new List<string> { workerScript };
            processArgs.AddRange(args);
            
            // Start Python process
            var startInfo = new ProcessStartInfo
            {
                FileName = pythonExe,
                Arguments = string.Join(" ", processArgs.Select(arg => $"\"{arg}\"")),
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                RedirectStandardInput = true,
                WorkingDirectory = workingDir
            };
            
            using var process = Process.Start(startInfo);
            if (process == null)
            {
                Console.Error.WriteLine("Failed to start Python process");
                return 1;
            }
            
            // Forward all streams
            Task.Run(async () => {
                string line;
                while ((line = await process.StandardOutput.ReadLineAsync()) != null)
                {
                    Console.WriteLine(line);
                }
            });
            Task.Run(async () => {
                string line;
                while ((line = await process.StandardError.ReadLineAsync()) != null)
                {
                    Console.Error.WriteLine(line);
                }
            });
            
            process.WaitForExit();
            return process.ExitCode;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Worker error: {ex.Message}");
            return 1;
        }
    }
    
    static string FindPython()
    {
        string[] pythonNames = { "python", "python3", "py" };
        
        foreach (string name in pythonNames)
        {
            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = name,
                    Arguments = "--version",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                
                using var process = Process.Start(startInfo);
                if (process != null)
                {
                    process.WaitForExit();
                    if (process.ExitCode == 0)
                        return name;
                }
            }
            catch { }
        }
        
        return null;
    }
    
    static string DetermineWorkingDirectory(string workerScriptPath)
    {
        // The working directory should be the directory that contains:
        // - cache/ directory (for beats.json, shots.json, etc.)
        // - render/ directory (for cutlist.json, output videos, etc.)  
        // - worker/ directory (containing the Python scripts)
        
        string dir = Path.GetDirectoryName(workerScriptPath);
        
        // If worker script is in worker/ subdirectory, go up one level to project root
        if (Path.GetFileName(dir) == "worker")
        {
            dir = Path.GetDirectoryName(dir);
        }
        
        // Verify this looks like a project root by checking for expected directories
        string[] expectedDirs = { "worker", "cache", "render" };
        foreach (string expectedDir in expectedDirs)
        {
            string fullPath = Path.Combine(dir, expectedDir);
            if (!Directory.Exists(fullPath))
            {
                // Create cache and render directories if they don't exist
                if (expectedDir == "cache" || expectedDir == "render")
                {
                    try 
                    {
                        Directory.CreateDirectory(fullPath);
                        Console.Error.WriteLine($"Debug: Created directory {fullPath}");
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"Debug: Failed to create directory {fullPath}: {ex.Message}");
                    }
                }
            }
        }
        
        return dir ?? Directory.GetCurrentDirectory();
    }
}
