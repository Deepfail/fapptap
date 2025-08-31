using System;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "-version")
        {
            Console.WriteLine("ffmpeg version n4.4.2 stub");
        }
        else
        {
            Console.WriteLine($"FFmpeg stub executing with args: {string.Join(" ", args)}");
        }
        Environment.Exit(0);
    }
}
