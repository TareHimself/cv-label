#pragma once

#include <napi.h>

#include <memory>
#include <torch/torch.h>
#include <string>

namespace nodeml_torch
{

    class Tensor : public Napi::ObjectWrap<Tensor>
    {

    public:
        static Napi::FunctionReference constructor;

        torch::Tensor tensor;
        static Napi::Object Init(Napi::Env env, Napi::Object exports);

        Tensor(const Napi::CallbackInfo &info);

        static Napi::Object FromTorchTensor(const Napi::CallbackInfo &info, torch::Tensor torchTensor);

        Napi::Value Shape(const Napi::CallbackInfo &info);

        Napi::Value ToArray(const Napi::CallbackInfo &info);

        Napi::Value View(const Napi::CallbackInfo &info);

        static Napi::Function GetClass(Napi::Env env);
    };

}