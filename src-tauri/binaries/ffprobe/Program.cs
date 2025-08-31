using System;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "-version")
        {
            Console.WriteLine("ffprobe version n4.4.2 stub");
        }
        else
        {
            Console.WriteLine($"FFprobe stub executing with args: {string.Join(" ", args)}");
        }
        Environment.Exit(0);
    }
}
