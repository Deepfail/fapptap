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
            // Get the project root directory - should be C:\Files\Projects\fapptap
            // From: C:\Files\Projects\fapptap\src-tauri\binaries\worker.exe
            // To:   C:\Files\Projects\fapptap\worker\main.py
            string exeDir = AppContext.BaseDirectory;
            string projectRoot = Path.GetFullPath(Path.Combine(exeDir, "..", ".."));
            string workerScript = Path.Combine(projectRoot, "worker", "main.py");
            
            Console.Error.WriteLine($"Debug: exeDir = {exeDir}");
            Console.Error.WriteLine($"Debug: projectRoot = {projectRoot}");
            Console.Error.WriteLine($"Debug: workerScript = {workerScript}");
            
            if (!File.Exists(workerScript))
            {
                Console.Error.WriteLine($"Worker script not found at {workerScript}");
                return 1;
            }
            
            // Find Python executable
            string pythonExe = FindPython();
            if (pythonExe == null)
            {
                Console.Error.WriteLine("Python executable not found in PATH");
                return 1;
            }
            
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
                WorkingDirectory = projectRoot
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
}
