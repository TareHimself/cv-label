#include "napi.h"
#include "Tensor.h"

using namespace nodeml_torch;

Napi::Object
Init(Napi::Env env, Napi::Object exports)
{
    Tensor::Init(env, exports);
    return exports;
}

NODE_API_MODULE(addon, Init);