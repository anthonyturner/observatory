using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

// Reads what the default speakers play (WASAPI loopback) and writes it to
// stdout as 32-bit float stereo at 48 kHz, interleaved, little-endian.
// Windows converts from the device's own mix format (AUTOCONVERTPCM), so the
// stream keeps one format even when the default device changes under it.
// Exits when stdin closes, so a server that dies never leaves it capturing.
public static class ObservatoryLoopback
{
    const int SampleRate = 48000;
    const int Channels = 2;
    const int BytesPerFrame = Channels * 4;

    const int RenderFlow = 0;
    const int ConsoleRole = 0;
    const int SharedMode = 0;
    const int ClsctxAll = 0x17;
    const int LoopbackFlag = 0x00020000;
    const int AutoConvertPcmFlag = unchecked((int)0x80000000);
    const int SrcDefaultQualityFlag = 0x08000000;
    const int SilentBufferFlag = 0x2;
    // 100 ms in 100-ns units: room for a late poll without losing sound.
    const long BufferDuration = 1000000;
    const int PollMilliseconds = 5;
    const int ReopenMilliseconds = 500;

    static readonly Guid AudioClientId = new Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2");
    static readonly Guid CaptureClientId = new Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317");
    static readonly Guid FloatSubFormat = new Guid("00000003-0000-0010-8000-00aa00389b71");

    static volatile bool stopping;

    public static int Run()
    {
        Stream output = Console.OpenStandardOutput();
        Thread watcher = new Thread(WatchStdin);
        watcher.IsBackground = true;
        watcher.Start();
        bool hasStarted = false;
        while (!stopping)
        {
            try
            {
                CaptureUntilInvalidated(output, ref hasStarted);
            }
            catch (IOException)
            {
                return 0;
            }
            catch (COMException error)
            {
                if (!hasStarted)
                {
                    Console.Error.WriteLine("loopback unavailable: 0x" + error.ErrorCode.ToString("X8"));
                    return 2;
                }
                Thread.Sleep(ReopenMilliseconds);
            }
        }
        return 0;
    }

    static void WatchStdin()
    {
        Stream input = Console.OpenStandardInput();
        byte[] buffer = new byte[64];
        try
        {
            while (input.Read(buffer, 0, buffer.Length) > 0) { }
        }
        catch (IOException) { }
        stopping = true;
    }

    static void CaptureUntilInvalidated(Stream output, ref bool hasStarted)
    {
        IMMDeviceEnumerator devices = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice speakers = devices.GetDefaultAudioEndpoint(RenderFlow, ConsoleRole);
        Guid audioClientId = AudioClientId;
        IAudioClient client = (IAudioClient)speakers.Activate(ref audioClientId, ClsctxAll, IntPtr.Zero);
        IntPtr format = StreamFormat();
        try
        {
            client.Initialize(SharedMode, LoopbackFlag | AutoConvertPcmFlag | SrcDefaultQualityFlag,
                BufferDuration, 0, format, IntPtr.Zero);
        }
        finally
        {
            Marshal.FreeCoTaskMem(format);
        }
        Guid captureClientId = CaptureClientId;
        IAudioCaptureClient capture = (IAudioCaptureClient)client.GetService(ref captureClientId);
        client.Start();
        if (!hasStarted)
        {
            Console.Error.WriteLine("capturing");
            hasStarted = true;
        }
        try
        {
            Pump(capture, output);
        }
        finally
        {
            client.Stop();
            Marshal.ReleaseComObject(capture);
            Marshal.ReleaseComObject(client);
            Marshal.ReleaseComObject(speakers);
            Marshal.ReleaseComObject(devices);
        }
    }

    static void Pump(IAudioCaptureClient capture, Stream output)
    {
        byte[] bytes = new byte[0];
        while (!stopping)
        {
            int frames = capture.GetNextPacketSize();
            if (frames == 0)
            {
                Thread.Sleep(PollMilliseconds);
                continue;
            }
            IntPtr data;
            int flags;
            long devicePosition;
            long counterPosition;
            capture.GetBuffer(out data, out frames, out flags, out devicePosition, out counterPosition);
            int length = frames * BytesPerFrame;
            if (bytes.Length < length) bytes = new byte[length];
            if ((flags & SilentBufferFlag) != 0) Array.Clear(bytes, 0, length);
            else Marshal.Copy(data, bytes, 0, length);
            capture.ReleaseBuffer(frames);
            output.Write(bytes, 0, length);
            output.Flush();
        }
    }

    // WAVEFORMATEXTENSIBLE for 48 kHz stereo float, in memory COM can read.
    static IntPtr StreamFormat()
    {
        IntPtr format = Marshal.AllocCoTaskMem(40);
        Marshal.WriteInt16(format, 0, unchecked((short)0xFFFE));
        Marshal.WriteInt16(format, 2, Channels);
        Marshal.WriteInt32(format, 4, SampleRate);
        Marshal.WriteInt32(format, 8, SampleRate * BytesPerFrame);
        Marshal.WriteInt16(format, 12, BytesPerFrame);
        Marshal.WriteInt16(format, 14, 32);
        Marshal.WriteInt16(format, 16, 22);
        Marshal.WriteInt16(format, 18, 32);
        Marshal.WriteInt32(format, 20, 3);
        Marshal.Copy(FloatSubFormat.ToByteArray(), 0, format + 24, 16);
        return format;
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumerator { }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        void EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        IMMDevice GetDefaultAudioEndpoint(int dataFlow, int role);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [return: MarshalAs(UnmanagedType.IUnknown)]
        object Activate(ref Guid iid, int clsCtx, IntPtr activationParams);
    }

    [ComImport, Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioClient
    {
        void Initialize(int shareMode, int streamFlags, long bufferDuration, long periodicity, IntPtr format, IntPtr sessionGuid);
        int GetBufferSize();
        long GetStreamLatency();
        int GetCurrentPadding();
        void IsFormatSupported(int shareMode, IntPtr format, out IntPtr closest);
        IntPtr GetMixFormat();
        void GetDevicePeriod(out long defaultPeriod, out long minimumPeriod);
        void Start();
        void Stop();
        void Reset();
        void SetEventHandle(IntPtr handle);
        [return: MarshalAs(UnmanagedType.IUnknown)]
        object GetService(ref Guid iid);
    }

    [ComImport, Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioCaptureClient
    {
        void GetBuffer(out IntPtr data, out int frames, out int flags, out long devicePosition, out long counterPosition);
        void ReleaseBuffer(int frames);
        int GetNextPacketSize();
    }
}
